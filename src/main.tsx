import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Layers,
  LayoutDashboard,
  Building2,
  Files,
  Upload as UploadIcon,
  X,
  GitBranch,
  Clock,
  ExternalLink,
  Copy,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  type State,
  type Molecule,
  type Gap,
  type Revision,
  originLabel,
  stageLabel,
  statusLabel,
  gapLabel,
  modalityLabel,
} from "./model";
import "./style.css";
import { Overview } from "./Overview";
import { overviewData } from "./summary-data";
import { ProgressBoard } from "./ProgressBoard";
import { TargetCatalog } from "./TargetCatalog";
import { Partnerships } from "./Partnerships";
import { ComputationalTarget } from "./ComputationalTarget";
import {
  researchState,
  computationalPapers,
  researchSources,
  type ResearchTrack,
} from "./research-view";
import { emptyFilters, type Filters } from "./explore";
function App() {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [s, setS] = useState<State | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("overview"),
    [businessQuery, setBusinessQuery] = useState(""),
    [readAt, setReadAt] = useState(""),
    [reading, setReading] = useState(false),
    [target, setTarget] = useState(""),
    [targetTrack, setTargetTrack] = useState<ResearchTrack | "all">(
      "development",
    ),
    [targetFilters, setTargetFilters] = useState<Filters>({ ...emptyFilters }),
    [selected, setSelected] = useState<Molecule | null>(null),
    [history, setHistory] = useState<Revision[] | null>(null),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    setReading(true);
    try {
      const r = await fetch("/api/state");
      if (!r.ok) throw Error("本地服务尚未连接");
      setS(await r.json());
      setReadAt(new Date().toISOString());
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setReading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setHistory(null);
    if (selected) closeRef.current?.focus();
  }, [selected?.id]);
  useEffect(() => {
    if (selected && s)
      setSelected(s.molecules.find((m) => m.id === selected.id) || null);
  }, [s]);
  useEffect(() => {
    function close(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelected(null);
        setHistory(null);
      }
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  if (!s)
    return (
      <main className="loading">
        <Layers />
        <h1>Peptide Atlas</h1>
        <p>{error || "正在读取本地数据…"}</p>
        <button onClick={load}>重新连接</button>
      </main>
    );
  const targetState = targetTrack === "all" ? s : researchState(s, targetTrack);
  const state = s,
    names = (ids: string[]) =>
      ids
        .map((id) => state.companies.find((x) => x.id === id)?.name || id)
        .join(" · "),
    src = (id: string) => state.sources.find((x) => x.id === id),
    activeTarget = state.targets.find((t) => t.id === target),
    mols = targetState.molecules.filter((m) => m.targetIds.includes(target)),
    pending = state.gaps.filter(
      (g) => !["resolved", "unobtainable"].includes(g.status),
    );
  const latestResearch = overviewData(s).latestResearch;
  const formatTime = (v: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(v));
  const openOverviewTarget = (id: string) => {
    setTargetTrack("development");
    setTargetFilters({ ...emptyFilters });
    setTarget(id);
    setTab("targets");
  };
  function revisionValue(k: string, v: unknown): string {
    if (Array.isArray(v))
      return v
        .map((id) =>
          k === "sourceIds"
            ? src(id)?.title || id
            : state.evidence.find((e) => e.id === id)?.title || id,
        )
        .join("；");
    if (v == null) return "尚未记录";
    const value = String(v);
    return k === "stage"
      ? stageLabel[value] || value
      : k === "status"
        ? statusLabel[value] || value
        : k === "origin"
          ? originLabel[value as keyof typeof originLabel] || value
          : k === "modality"
            ? modalityLabel[value] || value
            : value;
  }
  const sourceLink = (id: string) => {
    const x = src(id);
    return x ? (
      <a
        className="source-link"
        key={id}
        href={x.url}
        target="_blank"
        rel="noreferrer"
      >
        {x.title}
        <ArrowUpRight size={13} />
      </a>
    ) : null;
  };
  async function upload(g: Gap, files: FileList | null) {
    if (!files?.length) return;
    setBusy(g.id);
    setNotice("");
    try {
      for (const file of Array.from(files)) {
        const r = await fetch(
          `/api/gaps/${g.id}/uploads?name=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            headers: { "X-Atlas-Client": "workbench" },
            body: file,
          },
        );
        const v = await r.json();
        if (!r.ok) throw Error(v.error);
        setNotice(
          v.duplicate
            ? "相同文件已存在。"
            : "材料已接收；文件身份和科学结论仍需 Codex 核验。",
        );
      }
      await load();
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy("");
    }
  }
  async function archiveGap(g: Gap, reason: string) {
    if (!reason.trim()) return;
    setBusy(g.id);
    try {
      const r = await fetch("/api/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Atlas-Client": "workbench",
        },
        body: JSON.stringify({
          baseRevision: state.revision,
          reviewer: "人工确认无法获取",
          records: {
            gaps: [{ ...g, status: "unobtainable", resolution: reason.trim() }],
          },
        }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      setNotice("已归档，后续检索保留此记录。");
      await load();
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy("");
    }
  }
  async function packet(g: Gap) {
    const r = await fetch(`/api/gaps/${g.id}/packet`);
    if (!r.ok) {
      setNotice("无法读取任务包");
      return;
    }
    const data = await r.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${g.id}-packet.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTarget("");
            setTab("overview");
          }}
        >
          <span className="brand-icon">
            <GitBranch size={23} />
          </span>
          <span>
            Peptide Atlas<small>多肽研究与产业图谱</small>
          </span>
        </a>
        <div className="side-label">工作台</div>
        <nav>
          {[
            ["overview", "多肽总览", LayoutDashboard],
            ["targets", "靶点图谱", Layers],
            ["companies", "公司与合作", Building2],
            ["gaps", "待核实问题", Files],
          ].map(([id, label, Icon]) => {
            const I = Icon as typeof Layers;
            return (
              <button
                key={String(id)}
                className={tab === id ? "active" : ""}
                onClick={() => {
                  setTab(String(id));
                  if (id === "companies") setBusinessQuery("");
                  setTarget("");
                }}
              >
                <I size={19} />
                {String(label)}
                {id === "gaps" && <b>{pending.length}</b>}
              </button>
            );
          })}
        </nav>
        <div className="side-bottom">
          <span className="dot" /> 私有本地工作区
          <small>v{s.revision}</small>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            {tab === "overview"
              ? "多肽总览"
              : tab === "targets"
                ? "靶点图谱"
                : tab === "companies"
                  ? "公司与合作"
                  : tab === "gaps"
                    ? "待核实问题"
                    : "待核实问题"}
          </span>
          <div className="data-freshness">
            <details>
              <summary>最近核查 {latestResearch || "未记录"}</summary>
              <div>
                <p>
                  最近一次资料核查：{latestResearch || "未记录"}
                  （局部，不代表全库）
                </p>
                <p>
                  数据库最近写入：
                  {s.lastCommitAt ? formatTime(s.lastCommitAt) : "未记录"}
                </p>
                <p>本页读取：{readAt ? formatTime(readAt) : "未读取"}</p>
                <p>重新读取只加载本地数据库；联网检索与核验需要另行执行。</p>
              </div>
            </details>
            <button
              className="quiet"
              onClick={load}
              disabled={reading}
              aria-label="重新读取本地数据"
              title="加载已写入本地库的数据，不执行联网调研"
            >
              <RefreshCw size={16} />
              {reading ? "读取中…" : "重新读取"}
            </button>
          </div>
        </header>
        <main className={tab === "targets" && !target ? "overview-main" : ""}>
          {error && <p className="alert">{error}</p>}
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button onClick={() => setNotice("")} aria-label="关闭提示">
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "overview" && (
            <Overview
              state={s}
              onTarget={openOverviewTarget}
              onBusiness={(query) => {
                setBusinessQuery(query);
                setTab("companies");
                setTarget("");
              }}
            />
          )}
          {tab === "targets" && (
            <div hidden={!!target}>
              <TargetCatalog
                state={s}
                onSelect={(id, filters, track) => {
                  setTargetTrack(track);
                  setTargetFilters(filters);
                  setTarget(id);
                }}
              />
            </div>
          )}
          {tab === "targets" && activeTarget && (
            <>
              <button className="back" onClick={() => setTarget("")}>
                <ArrowLeft size={16} />
                全部靶点
              </button>
              <div className="page-heading">
                <div>
                  <h1>{activeTarget.name}</h1>
                </div>
                <span className="tag">
                  {targetTrack === "computational"
                    ? `${computationalPapers(targetState, activeTarget.id).length} 篇论文`
                    : `${mols.length} 条分子记录`}
                </span>
              </div>
              {targetTrack === "computational" ? (
                <ComputationalTarget
                  state={targetState}
                  targetId={activeTarget.id}
                  onOpen={setSelected}
                />
              ) : (
                <ProgressBoard
                  key={activeTarget.id}
                  state={targetState}
                  targetId={activeTarget.id}
                  initialFilters={targetFilters}
                  onOpen={setSelected}
                />
              )}
              <button
                className="target-gap-link"
                onClick={() => setTab("gaps")}
              >
                <Files size={15} />
                待核实问题{" "}
                {pending.filter((g) => g.targetIds.includes(target)).length}
                <ChevronRight size={14} />
              </button>
            </>
          )}
          {tab === "companies" && (
            <Partnerships
              key={businessQuery}
              initialQuery={businessQuery}
              state={s}
              onMolecule={setSelected}
              onTarget={(id) => {
                setTargetTrack("all");
                setTargetFilters({ ...emptyFilters });
                setTarget(id);
                setTab("targets");
              }}
            />
          )}
          {tab === "gaps" && (
            <>
              <div className="page-heading">
                <div>
                  <h1>待核实问题</h1>
                  <p>查看不确定的原因，补交所需原文，再由 Codex 核验更新。</p>
                </div>
                <span className="tag">{pending.length} 项未解决</span>
              </div>
              <div className="flow">
                <span>打开原文</span>
                <ChevronRight size={15} />
                <span>下载并提交 PDF</span>
                <ChevronRight size={15} />
                <span>Codex 核验身份与内容</span>
                <ChevronRight size={15} />
                <span>更新事实与历史</span>
              </div>
              {!pending.length && <p className="muted">暂无待核实问题</p>}
              {pending.map((g) => (
                <section className="gap" key={g.id}>
                  <div className="card-kicker">
                    {[...g.targetIds.map(id=>s.targets.find(t=>t.id===id)?.name),...(g.companyIds||[]).map(id=>s.companies.find(c=>c.id===id)?.name)].filter(Boolean).join(" · ")}
                    <span className="tag">{gapLabel[g.status]}</span>
                  </div>
                  <h2>{g.title}</h2>
                  <div className="gap-detail">
                    <div>
                      <h4>为什么不确定</h4>
                      <p>{g.reason}</p>
                    </div>
                    <div>
                      <h4>需要你提供</h4>
                      <p>{g.requested}</p>
                    </div>
                  </div>
                  <div className="actions">
                    {g.urls.map((u, i) => (
                      <a
                        className="button outline"
                        key={u}
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {g.urls.length > 1 ? `原文入口 ${i + 1}` : "打开原文"}
                        <ExternalLink size={14} />
                      </a>
                    ))}
                    <label
                      className={"button " + (busy === g.id ? "disabled" : "")}
                    >
                      <UploadIcon size={16} />
                      {busy === g.id ? "接收中…" : "提交 PDF"}
                      <input
                        aria-label={"提交 " + g.title + " 的PDF"}
                        type="file"
                        accept="application/pdf,.pdf"
                        multiple
                        hidden
                        disabled={busy === g.id}
                        onChange={(e) => {
                          upload(g, e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button className="outline" onClick={() => packet(g)}>
                      <Files size={15} />
                      下载审阅任务包
                    </button>
                    <button
                      className="quiet"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            `请使用本仓库 peptide-evidence-update skill 处理证据缺口 ${g.id}。运行 python3 atlas.py packet ${g.id}，读取上传原文，核验身份和科学证据后，用 commit 原子更新审阅、事实和历史。不要把格式检查通过当成科学核验通过。`,
                          );
                          setNotice("已复制，粘贴给本地 Codex 即可。");
                        } catch {
                          setNotice(
                            `请让 Codex 运行 python3 atlas.py packet ${g.id}`,
                          );
                        }
                      }}
                    >
                      <Copy size={15} />
                      复制给 Codex
                    </button>
                  </div>
                  <details className="archive-gap">
                    <summary>无法获取，归档此问题</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const reason = new FormData(e.currentTarget).get(
                          "reason",
                        );
                        archiveGap(g, String(reason || ""));
                      }}
                    >
                      <label>
                        人工核查结果
                        <textarea
                          name="reason"
                          required
                          maxLength={2000}
                          placeholder="例如：已查出版社和机构入口，仍无法下载所需补充材料"
                        />
                      </label>
                      <button className="outline" disabled={busy === g.id}>
                        确认归档
                      </button>
                    </form>
                  </details>
                  {s.uploads
                    .filter((u) => u.gapId === g.id)
                    .map((u) => (
                      <div className="upload" key={u.id}>
                        <Files size={18} />
                        <div>
                          <strong>{u.name}</strong>
                          <p>{u.formatCheck.reason}</p>
                          <small>
                            SHA256 {u.sha256.slice(0, 16)}… ·{" "}
                            {u.formatCheck.pages
                              ? `${u.formatCheck.pages} 页 · `
                              : ""}
                            身份 / 科学：
                            {s.reviews.find((r) => r.uploadId === u.id)?.note ||
                              "待核验"}
                          </small>
                        </div>
                        <a href={`/api/uploads/${u.id}/content`}>下载</a>
                      </div>
                    ))}
                  {g.resolution && <p className="notice">{g.resolution}</p>}
                </section>
              ))}
            </>
          )}
        </main>
        <footer className="page-footer">
          Peptide Atlas · 公开证据研究工作台
          <span>公开资料 · 本地维护</span>
        </footer>
      </div>
      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            className="drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              className="close"
              aria-label="关闭分子详情"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <div className="eyebrow">MOLECULE RECORD</div>
            <h1>{selected.name}</h1>
            <p>{names(selected.companyIds)}</p>
            <div className="pills">
              <span>{modalityLabel[selected.modality]}</span>
              <span>{selected.specificity}</span>
              <span>{originLabel[selected.origin]}</span>
              <span>{stageLabel[selected.stage]}</span>
              <span>{statusLabel[selected.status]}</span>
            </div>
            <p>{selected.description}</p>
            <h3>化学身份</h3>
            <div className="sequence">
              {selected.sequence || "精确序列 / 化学结构尚待原文核验"}
            </div>
            <p className="muted">
              {selected.sequenceNote} · 记录层级：
              {selected.recordLevel === "molecule"
                ? "分子身份"
                : selected.recordLevel === "core-sequence"
                  ? "核心序列"
                  : "系列编号成员"}
            </p>
            <p className="muted">
              已关联论文 / 专利资料：{researchSources(s, [selected]).length} 份
            </p>
            <h3>证据与演变</h3>
            <div className="timeline">
              {s.evidence
                .filter((e) => e.moleculeIds.includes(selected.id))
                .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
                .map((e) => (
                  <article key={e.id}>
                    <span className="timeline-dot" />
                    <small>
                      {e.date || "事件日期未明确"} ·{" "}
                      {e.verification === "reviewed"
                        ? "已核实"
                        : e.verification === "inference"
                          ? "推断"
                          : "待核实"}{" "}
                      ·{" "}
                      {e.outcome === "planned"
                        ? "计划实施"
                        : e.outcome === "reported"
                          ? "已报告"
                          : "未说明实施"}
                    </small>
                    <h3>
                      {e.topic === "cmc" && (
                        <span className="tag">CMC / 制剂</span>
                      )}{" "}
                      {e.title}
                    </h3>
                    <p>{e.summary}</p>
                    {e.assay && (
                      <div className="assay">
                        {e.assay.metric} {e.assay.relation} {e.assay.value}{" "}
                        {e.assay.unit}
                        <small>{e.assay.context}</small>
                      </div>
                    )}
                    {sourceLink(e.sourceId)}
                    <small>定位：{e.locator}</small>
                  </article>
                ))}
            </div>
            <button
              className="outline"
              onClick={async () => {
                const r = await fetch(
                  `/api/history?kind=molecules&id=${selected.id}`,
                );
                setHistory(await r.json());
              }}
            >
              <Clock size={15} />
              查看记录修订
            </button>
            {history && (
              <div className="revision-list">
                {history.map((h) => (
                  <article key={h.commitId}>
                    <small>
                      {new Date(h.at).toLocaleString("zh-CN")} · {h.reviewer}
                    </small>
                    <h4>{h.before ? "记录修订" : "首次建档"}</h4>
                    {h.before ? (
                      (
                        [
                          "name",
                          "specificity",
                          "stage",
                          "status",
                          "origin",
                          "modality",
                          "sequence",
                          "sequenceNote",
                          "description",
                          "asOf",
                          "sourceIds",
                          "stageEvidenceIds",
                        ] as const
                      )
                        .filter(
                          (k) =>
                            JSON.stringify(h.before?.[k]) !==
                            JSON.stringify(h.after[k]),
                        )
                        .map((k) => (
                          <div className="revision-field" key={k}>
                            <b>
                              {
                                {
                                  name: "名称",
                                  specificity: "靶点范围",
                                  stage: "阶段",
                                  status: "动向",
                                  origin: "发现路线",
                                  modality: "分子模态",
                                  sequence: "序列",
                                  sequenceNote: "化学身份说明",
                                  description: "记录说明",
                                  asOf: "核查日期",
                                  sourceIds: "来源",
                                  stageEvidenceIds: "阶段依据",
                                }[k]
                              }
                            </b>
                            <span>{revisionValue(k, h.before?.[k])}</span>
                            <ArrowRight size={12} />
                            <strong>{revisionValue(k, h.after[k])}</strong>
                          </div>
                        ))
                    ) : (
                      <p>
                        {h.after.name} · {stageLabel[h.after.stage]} ·{" "}
                        {statusLabel[h.after.status]}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
            <small className="asof">
              最后核查：{selected.asOf}
              。阶段按已收录证据；旧日期不代表已完成当前全面复查。
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
