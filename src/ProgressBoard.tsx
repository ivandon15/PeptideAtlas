import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  GitBranch,
  Pin,
  Info,
  X,
  ExternalLink,
  Search,
  ChevronLeft,
} from "lucide-react";
import type { State, Molecule } from "./model";
import { stageLabel, statusLabel, originLabel } from "./model";
import {
  marksFor,
  defaultAnchor,
  familyOrder,
  connectedFamily,
  yearDomain,
  clinicalWindow,
  type Mark,
} from "./progress";
import { isRecent } from "./summary-data";
import "./progress.css";
import {
  matchingMolecules,
  emptyFilters,
  pageItems,
  clusterMarks,
  type Filters,
} from "./explore";
export function ProgressBoard({
  state,
  targetId,
  onOpen,
  initialFilters,
  context = state,
}: {
  state: State;
  targetId: string;
  onOpen: (m: Molecule) => void;
  initialFilters?: Filters;
  context?: State;
}) {
  const detailRef = useRef<HTMLDivElement>(null);
  const all = state.molecules.filter((m) => m.targetIds.includes(targetId));
  const [pin, setPin] = useState(""),
    [seriesId, setSeries] = useState(""),
    [picked, setPicked] = useState<Mark | null>(null),
    [onlyFamily, setOnlyFamily] = useState(false),
    [track, setTrack] = useState("progress"),
    [filters, setFilters] = useState({ ...(initialFilters || emptyFilters) }),
    [page, setPage] = useState(1),
    [pickedGroup, setPickedGroup] = useState<Mark[]>([]);
  useEffect(() => {
    if (picked) {
      const el = detailRef.current;
      if (el && el.getBoundingClientRect().bottom > window.innerHeight)
        el.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
    }
  }, [picked?.id]);
  const fallback =
    defaultAnchor(
      matchingMolecules(state, all, { ...filters, series: seriesId }),
    ) || defaultAnchor(all);
  const anchor = all.find((m) => m.id === pin) || fallback;
  if (!anchor) return <p>尚未收录可追踪分子。</p>;
  const relevant = connectedFamily(anchor.id, state.relations);
  const matches = familyOrder(
    matchingMolecules(state, all, { ...filters, series: seriesId }).filter(
      (m) => !onlyFamily || relevant.has(m.id),
    ),
    state.relations,
  );
  const paged = pageItems(matches, page, 12),
    rows = paged.items;
  const update = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setPicked(null);
  };
  function reset() {
    setFilters({ ...emptyFilters });
    setSeries("");
    setOnlyFamily(false);
    setPage(1);
    setPicked(null);
  }
  const allMarks = rows.flatMap((m) =>
      marksFor(m, state.evidence, state.sources),
    ),
    asOf =
      all
        .map((m) => m.asOf)
        .sort()
        .at(-1) || "2026-10-26",
    domain = yearDomain(
      all.flatMap((m) => marksFor(m, state.evidence, state.sources)),
      asOf,
    );
  const start = Date.UTC(domain.start, 0, 1),
    end = Date.UTC(domain.end + 1, 0, 1),
    x = (date: string) =>
      Math.max(
        2,
        Math.min(98, (100 * (Date.parse(date) - start)) / (end - start)),
      );
  const years = Array.from(
    { length: domain.end - domain.start + 1 },
    (_, i) => domain.start + i,
  );
  const relationName = (type: string) =>
    type === "derived"
      ? "直接优化"
      : type === "same-series"
        ? "同系列"
        : "资源转向";
  const source =
    picked && state.sources.find((s) => s.id === picked.evidence.sourceId);
  function focus(m: Molecule) {
    setPin(m.id);
    setPage(1);
    setPicked(null);
  }
  return (
    <section className="progress-board" aria-label="分子谱系与研发时间轴">
      <div className="board-top">
        <h2>
          分子时间轴{" "}
          <span className="result-count">
            {matches.length} / {all.length}
          </span>
        </h2>
        <time>{asOf}</time>
      </div>
      <div className="molecule-filters">
        <label className="catalog-search">
          <Search size={16} />
          <input
            aria-label="搜索分子"
            placeholder="分子、别名或系列"
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
          />
        </label>
        <label>
          <span>系列</span>
          <select
            aria-label="筛选系列"
            value={seriesId}
            onChange={(e) => {
              setSeries(e.target.value);
              setPage(1);
              setPicked(null);
            }}
          >
            <option value="">全部系列</option>
            {state.series
              .filter((s) => s.targetIds.includes(targetId))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>阶段</span>
          <select
            aria-label="分子阶段"
            value={filters.stage}
            onChange={(e) => update("stage", e.target.value)}
          >
            <option value="">全部阶段</option>
            {Object.entries(stageLabel).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            aria-label="分子状态"
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">全部状态</option>
            {Object.entries(statusLabel).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>路线</span>
          <select
            aria-label="分子发现路线"
            value={filters.origin}
            onChange={(e) => update("origin", e.target.value)}
          >
            <option value="">全部路线</option>
            {Object.entries(originLabel).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>公司</span>
          <input
            aria-label="分子公司"
            placeholder="公司名称"
            value={filters.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </label>
      </div>
      <div className="board-control-row">
        <div
          className="series-switch track-switch"
          role="group"
          aria-label="选择进展类型"
        >
          {[
            ["progress", "研发 / 临床"],
            ["cmc", "CMC / 制剂"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={track === id}
              onClick={() => {
                setTrack(id);
                setPicked(null);
              }}
            >
              {label}
              <span>
                {
                  allMarks.filter((m) =>
                    id === "cmc" ? m.kind === "cmc" : m.kind !== "cmc",
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="board-actions">
          <label className="family-toggle">
            <input
              type="checkbox"
              aria-label="关注谱系"
              checked={onlyFamily}
              onChange={(e) => {
                const checked = e.target.checked;
                reset();
                setOnlyFamily(checked);
              }}
            />
            关注谱系{onlyFamily && <strong>{anchor.name}</strong>}
          </label>
          {(Object.values(filters).some(Boolean) || seriesId || onlyFamily) && (
            <button className="reset-filter" onClick={reset}>
              清除筛选
            </button>
          )}
        </div>
      </div>
      <div className="board-legend">
        <span>
          <i className="legend-dot stage" />
          阶段
        </span>
        <span>
          <i className="legend-dot status" />
          状态
        </span>
        <span>
          <i className="legend-dot research" />
          研究
        </span>
        <span>
          <GitBranch size={13} />
          衍生
        </span>
      </div>
      <div
        className="track-scroll"
        tabIndex={0}
        role="region"
        aria-label="可横向滚动的研发时间轴"
      >
        <div className="track-grid">
          <div className="track-head">
            <div>分子与谱系</div>
            <div className="year-axis">
              {years.map((y) => (
                <span key={y} style={{ left: x(y + "-01-01") + "%" }}>
                  {y}
                </span>
              ))}
            </div>
            <div>阶段 / 最新动向</div>
          </div>
          <div className="track-body">
            <svg
              className="family-links"
              width="76"
              height={rows.length * 112}
              aria-hidden="true"
            >
              {state.relations
                .filter(
                  (r) =>
                    r.type === "derived" &&
                    r.verification === "reviewed" &&
                    rows.some((m) => m.id === r.from) &&
                    rows.some((m) => m.id === r.to),
                )
                .map((r, i) => {
                  const a = rows.findIndex((m) => m.id === r.from),
                    b = rows.findIndex((m) => m.id === r.to),
                    lane = 12 + (i % 4) * 12;
                  return (
                    <g key={r.id}>
                      <path
                        d={`M 67 ${a * 112 + 48} H ${lane} V ${b * 112 + 48} H 62`}
                        fill="none"
                        stroke="#9aafb5"
                        strokeWidth="1.5"
                      />
                      <path
                        d={`M 58 ${b * 112 + 44} L 64 ${b * 112 + 48} L 58 ${b * 112 + 52}`}
                        fill="none"
                        stroke="#9aafb5"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
            </svg>
            {rows.map((m) => {
              const marks = marksFor(m, state.evidence, state.sources).filter(
                  (mark) =>
                    track === "cmc" ? mark.kind === "cmc" : mark.kind !== "cmc",
                ),
                isAnchor = m.id === anchor.id,
                isStopped = m.status === "stopped",
                window = clinicalWindow(marks);
              return (
                <div
                  className={
                    "track-row " +
                    (isAnchor ? "is-anchor " : "") +
                    (isStopped ? "is-stopped" : "")
                  }
                  key={m.id}
                >
                  <div className="track-molecule">
                    <div className="molecule-identity">
                      <button
                        className="molecule-title"
                        onClick={() => onOpen(m)}
                      >
                        {m.name}
                        <ArrowUpRight size={12} />
                      </button>
                      <small>
                        {state.companies
                          .filter((c) => m.companyIds.includes(c.id))
                          .map((c) => c.name.split(" / ")[0])
                          .join(" · ")}
                      </small>
                      <small className="mobile-parent">
                        {state.relations
                          .filter(
                            (r) =>
                              r.type === "derived" &&
                              r.verification === "reviewed" &&
                              r.to === m.id,
                          )
                          .map(
                            (r) =>
                              "← " +
                              (state.molecules.find((p) => p.id === r.from)
                                ?.name || r.from),
                          )
                          .join(" / ")}
                      </small>
                      <div className="lane-meta">
                        <span>{originLabel[m.origin]}</span>
                        {isAnchor && (
                          <span className="anchor-badge">
                            <Pin size={10} />
                            关注
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className={"pin-button " + (isAnchor ? "pinned" : "")}
                      aria-pressed={isAnchor}
                      title={isAnchor ? "当前进度锚点" : "设为进度锚点"}
                      aria-label={"设为进度锚点：" + m.name}
                      onClick={() => focus(m)}
                    >
                      <Pin size={14} />
                    </button>
                  </div>
                  <div className="track-time">
                    {years.map((y) => (
                      <i
                        className="year-line"
                        key={y}
                        style={{ left: x(y + "-01-01") + "%" }}
                      />
                    ))}
                    <div className="evidence-rail" />
                    {window && (
                      <div
                        className="clinical-window"
                        style={{
                          left: x(window.start) + "%",
                          width: x(window.end) - x(window.start) + "%",
                        }}
                        title={`${window.start} → ${window.end}：临床启动至状态披露的公开追踪窗口，非已确认的阶段持续时长`}
                      >
                        <span>临床</span>
                      </div>
                    )}
                    {marks.length === 0 ? (
                      <span className="undated">—</span>
                    ) : (
                      clusterMarks(marks, (end - start) / 86400000).map(
                        (group, i) => {
                          const mark = group[0];
                          return (
                            <button
                              key={group.map((m) => m.id).join("|")}
                              className={
                                "time-mark kind-" +
                                (group.length > 1 ? "cluster" : mark.kind) +
                                (group.some((m) => isRecent(m.date))
                                  ? " recent-mark"
                                  : "") +
                                (picked && group.some((m) => m.id === picked.id)
                                  ? " selected"
                                  : "")
                              }
                              style={{
                                left: x(mark.date) + "%",
                                top: 25 + (i % 2) * 36,
                              }}
                              onClick={() => {
                                setPickedGroup(group);
                                setPicked(mark);
                              }}
                              aria-label={`${m.name} · ${mark.date} · ${group.length > 1 ? group.length + " 条事件" : mark.label}`}
                              title={group
                                .map((m) => m.date + " · " + m.label)
                                .join("\n")}
                            >
                              <span className="mark-dot">
                                {group.length > 1 ? group.length : ""}
                              </span>
                              <span className="mark-caption">
                                {group.length > 1
                                  ? group.length + " 条事件"
                                  : mark.label}
                              </span>
                            </button>
                          );
                        },
                      )
                    )}
                  </div>
                  <div className="track-status">
                    <strong>{stageLabel[m.stage]}</strong>
                    <span className={"state-pill state-" + m.status}>
                      {statusLabel[m.status]}
                    </span>
                    <button className="lane-open" onClick={() => onOpen(m)}>
                      档案
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {track === "cmc" && (
        <div className="cmc-events" aria-label="工艺研究列表">
          {allMarks
            .filter((m) => m.kind === "cmc")
            .map((mark) => (
              <button
                key={mark.id}
                aria-pressed={picked?.id === mark.id}
                onClick={() => {
                  setPickedGroup([mark]);
                  setPicked(mark);
                }}
              >
                <time>{mark.date}</time>
                <strong>{mark.label}</strong>
                <ChevronRight size={14} />
              </button>
            ))}
        </div>
      )}
      {paged.pages > 1 && (
        <div className="pagination">
          <button
            aria-label="上一页分子"
            disabled={paged.current === 1}
            onClick={() => {
              setPage(paged.current - 1);
              setPicked(null);
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {paged.current} / {paged.pages}
          </span>
          <button
            aria-label="下一页分子"
            disabled={paged.current === paged.pages}
            onClick={() => {
              setPage(paged.current + 1);
              setPicked(null);
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {!matches.length && (
        <div className="filter-empty">
          <Search size={22} />
          <h3>没有匹配分子</h3>
          <button onClick={reset}>清除筛选</button>
        </div>
      )}
      {picked && (
        <div
          ref={detailRef}
          className="mark-detail"
          role="region"
          aria-label="进度节点证据"
        >
          {pickedGroup.length > 1 && (
            <div className="event-choices">
              {pickedGroup.map((mark) => (
                <button
                  key={mark.id}
                  aria-pressed={mark.id === picked.id}
                  onClick={() => setPicked(mark)}
                >
                  {mark.date} · {mark.evidence.title}
                </button>
              ))}
            </div>
          )}
          <div className="mark-detail-heading">
            <div>
              <span className="eyebrow">
                {picked.date} · {picked.basis}
              </span>
              <h3>{picked.evidence.title}</h3>
            </div>
            <button
              className="icon-button"
              aria-label="关闭节点证据"
              onClick={() => setPicked(null)}
            >
              <X size={18} />
            </button>
          </div>
          <p>{picked.evidence.summary}</p>
          <div className="mark-detail-source">
            <small>定位：{picked.evidence.locator}</small>
            {source && (
              <a href={source.url} target="_blank" rel="noreferrer">
                查看原始来源
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      )}
      <details className="relationship-details">
        <summary>
          <Info size={15} />
          图例与口径
          <ChevronRight size={15} />
        </summary>
        <p>
          节点：证据公开或事件日期。区间：临床启动至状态披露。数字：相邻事件数。获批范围见地区与适应证。
        </p>
      </details>
      <details className="relationship-details">
        <summary>
          <GitBranch size={15} />
          谱系证据{" "}
          <span>
            {
              state.relations.filter((r) =>
                rows.some((m) => m.id === r.from || m.id === r.to),
              ).length
            }{" "}
            条
          </span>
          <ChevronRight size={15} />
        </summary>
        {state.relations
          .filter((r) => rows.some((m) => m.id === r.from || m.id === r.to))
          .map((r) => (
            <article key={r.id}>
              <strong>
                {context.molecules.find((m) => m.id === r.from)?.name} →{" "}
                {context.molecules.find((m) => m.id === r.to)?.name}
              </strong>
              <span className="tag">
                {relationName(r.type)} ·{" "}
                {r.verification === "reviewed" ? "原文证实" : "推断"}
              </span>
              <p>{r.reason}</p>
              <a
                href={state.sources.find((s) => s.id === r.sourceId)?.url}
                target="_blank"
                rel="noreferrer"
              >
                核查关系来源
                <ExternalLink size={12} />
              </a>
            </article>
          ))}
      </details>
    </section>
  );
}
