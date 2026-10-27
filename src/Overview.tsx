import type { State } from "./model";
import { useState } from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { overviewData, shanghaiDate } from "./summary-data";
import { eventLabels, eventKind, dealDate } from "./business";
import { researchState, computationalPapers } from "./research-view";
import "./overview.css";
export function Overview({
  state: s,
  onTarget,
  onBusiness,
}: {
  state: State;
  onTarget: (id: string) => void;
  onBusiness: (query: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const today = shanghaiDate(),
    data = overviewData(s, today),
    calc = researchState(s, "computational");
  const observations = (s.observations || [])
    .filter((o) => ["active", "needs-review"].includes(o.status))
    .sort(
      (a, b) => b.asOf.localeCompare(a.asOf) || a.title.localeCompare(b.title),
    );
  const recent = [
    ...data.recentDeals.map((d) => ({
      id: "d" + d.id,
      date: dealDate(d),
      title: d.name,
      kind: eventLabels[eventKind(d)],
      sourceIds: d.sourceIds,
      query: s.companies.find((c) => c.id === d.fromCompanyId)?.name,
      targetId: "",
    })),
    ...data.recentEvidence.map((e) => ({
      id: "e" + e.id,
      date: e.date!,
      title: e.title,
      kind: e.line === "method" ? "工艺与方法" : "研究与研发",
      sourceIds: [e.sourceId],
      query: undefined,
      targetId:
        s.molecules.find((m) => e.moleculeIds.includes(m.id))?.targetIds[0] ||
        "",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="overview-dashboard">
      <div className="catalog-title">
        <h1>多肽总览</h1>
        <span>截至 {today} · 当前收录</span>
      </div>
      <div className="overview-metrics">
        {[
          [s.targets.length, "靶点 / 靶点组"],
          [data.development.molecules.length, "研发分子记录"],
          [computationalPapers(calc).length, "计算设计论文"],
          [s.deals.length, "合作与商业事件"],
        ].map(([n, label]) => (
          <div key={String(label)}>
            <strong>{n}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section className="overview-panel">
        <div className="panel-title">
          <h2>当前观察</h2>
          <span>基于当前资料，不代表全行业</span>
        </div>
        <div className="insight-grid">
          {observations.map((o) => (
            <article
              key={o.id}
              className={
                o.status === "needs-review" ? "observation-pending" : ""
              }
            >
              <div className="observation-meta">
                <time>{o.asOf}</time>
                {o.status === "needs-review" && (
                  <span className="recent-badge">依据有变 · 待复核</span>
                )}
              </div>
              <h3>{o.title}</h3>
              <p>{o.summary}</p>
              <div>
                {(o.targetIds || []).map((id) => (
                  <button key={id} onClick={() => onTarget(id)}>
                    {s.targets.find((t) => t.id === id)?.name}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
                {(o.companyIds || []).map((id) => (
                  <button
                    key={id}
                    onClick={() =>
                      onBusiness(
                        s.companies.find((c) => c.id === id)?.name || id,
                      )
                    }
                  >
                    {s.companies.find((c) => c.id === id)?.name}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
              <details className="observation-detail">
                <summary>判断与依据</summary>
                <h4>推断 / 假设</h4>
                <p>{o.interpretation}</p>
                <h4>限制与反证</h4>
                <p>{o.uncertainty}</p>
                <h4>下一步验证</h4>
                <p>{o.nextCheck}</p>
                <small>
                  {o.coverage} · {o.author} · 基于 v{o.basedOnRevision}
                </small>
                <div className="observation-sources">
                  {o.sourceIds.map((id) => {
                    const p = s.sources.find((p) => p.id === id);
                    return (
                      p && (
                        <a
                          key={id}
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.title}
                          <ExternalLink size={11} />
                        </a>
                      )
                    );
                  })}
                </div>
              </details>
            </article>
          ))}
        </div>
        {!observations.length && <p className="muted">暂无已保存观察</p>}
      </section>
      <div className="overview-grid">
        <section className="overview-panel">
          <div className="panel-title">
            <h2>靶点研发分布</h2>
            <span>分子记录数</span>
          </div>
          <div className="stage-key">
            <span>
              <i style={{ background: "#a1bbb4" }} />
              临床前
            </span>
            <span>
              <i style={{ background: "#6d9eae" }} />
              临床 / 申报
            </span>
            <span>
              <i style={{ background: "#42745e" }} />
              获批
            </span>
          </div>
          <div className="target-bars">
            {data.targets.slice(0, showAll ? undefined : 8).map((t) => (
              <button
                onClick={() => onTarget(t.id)}
                key={t.id}
                aria-label={`查看${t.name}，${t.count}条分子记录`}
              >
                <span>{t.name}</span>
                <div className="bar-track">
                  <div
                    className="bar-stack"
                    style={{
                      width:
                        (100 * t.count) /
                          Math.max(1, data.targets[0]?.count || 1) +
                        "%",
                    }}
                  >
                    {[
                      [t.early, "#a1bbb4"],
                      [t.clinical, "#6d9eae"],
                      [t.approved, "#42745e"],
                      [t.unknown, "#dce3df"],
                    ].map(([n, color], i) => (
                      <i
                        key={i}
                        style={{
                          width: (100 * Number(n)) / t.count + "%",
                          background: String(color),
                        }}
                      />
                    ))}
                  </div>
                </div>
                <b>{t.count}</b>
              </button>
            ))}
          </div>
          {data.targets.length > 8 && (
            <button
              className="overview-more"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "收起" : "全部靶点"}
            </button>
          )}
          <small>多靶点分子在各靶点分别计入；获批地区与适应证见详情。</small>
        </section>
        <section className="overview-panel">
          <div className="panel-title">
            <h2>合作类型与公司</h2>
            <span>已收录事件</span>
          </div>
          <div className="kind-distribution">
            {data.kinds.map(([kind, n]) => (
              <div key={kind}>
                <span>{eventLabels[kind] || kind}</span>
                <div>
                  <i
                    style={{
                      width:
                        (100 * n) /
                          Math.max(1, ...data.kinds.map((x) => x[1])) +
                        "%",
                    }}
                  />
                </div>
                <b>{n}</b>
              </div>
            ))}
          </div>
          <h3>合作事件较多的公司</h3>
          <div className="company-ranks">
            {data.companies.slice(0, 5).map((c) => (
              <button key={c.id} onClick={() => onBusiness(c.name)}>
                <span>{c.name}</span>
                <b>{c.count}</b>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <small>含修订、投资等不同事件；不代表独立交易数或市场排名。</small>
        </section>
      </div>
      <section className="overview-panel">
        <div className="panel-title">
          <h2>近五天的新进展</h2>
          <span>按事件日期 · 含今天</span>
        </div>
        {recent.length ? (
          <div className="recent-feed">
            {recent.map((e) => (
              <article key={e.id}>
                <time>{e.date}</time>
                <span className="recent-badge">{e.kind}</span>
                <button
                  onClick={() =>
                    e.query
                      ? onBusiness(e.query)
                      : e.targetId && onTarget(e.targetId)
                  }
                >
                  {e.title}
                  <ArrowUpRight size={14} />
                </button>
                <div>
                  {e.sourceIds.map((id) => {
                    const p = s.sources.find((p) => p.id === id);
                    return (
                      p && (
                        <a
                          key={id}
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          来源 <ExternalLink size={11} />
                        </a>
                      )
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">
            当前库未收录近五天的已核实事件，不表示行业没有新进展。
          </p>
        )}
      </section>
      <details className="overview-scope">
        <summary>统计口径与总结模板</summary>
        <p>
          每次总结使用：① 截止日期与覆盖范围；② 靶点、技术和合作方向的变化；③
          可追溯的依据与不确定性；④
          下一轮需要验证的问题。没有时间对照的数据只描述当前分布，不写“增长”或“转向”。
        </p>
        <p>
          研究核查时间不是事件日期。刚录入的旧事件不会标为近五天；仅知月份、计划事件和未核实线索不计入近期进展。数据库仍为部分覆盖，不据“零记录”宣称机会空白。
        </p>
      </details>
    </section>
  );
}
