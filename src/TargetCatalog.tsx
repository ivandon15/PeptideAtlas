import { useState } from "react";
import { Search, ArrowUpRight, X } from "lucide-react";
import type { State } from "./model";
import { stageLabel, originLabel } from "./model";
import { targetResults, emptyFilters, type Filters } from "./explore";
import {
  researchState,
  computationalPapers,
  computationalResults,
  type ResearchTrack,
  isProgram,
} from "./research-view";
import { targetIsRecent } from "./summary-data";
import "./explore.css";
export function TargetCatalog({
  state,
  onSelect,
}: {
  state: State;
  onSelect: (id: string, filters: Filters, track: ResearchTrack) => void;
}) {
  const [track, setTrack] = useState<ResearchTrack>("development");
  const visible = researchState(state, track, true);
  const [filters, setFilters] = useState({ ...emptyFilters }),
    [sort, setSort] = useState("updated");
  const update = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const results =
    track === "computational"
      ? computationalResults(visible, filters.query, sort)
      : targetResults(visible, filters, sort).sort((a, b) =>
          sort === "count"
            ? b.molecules.filter(isProgram).length -
                a.molecules.filter(isProgram).length ||
              a.target.name.localeCompare(b.target.name)
            : 0,
        );
  const filtered =
    track === "computational"
      ? !!filters.query
      : Object.values(filters).some(Boolean);
  const buckets = [
    ["early", "临床前", "#a1bbb4"],
    ["clinical", "临床", "#6d9eae"],
    ["approved", "获批", "#42745e"],
  ] as const;
  return (
    <section className="target-catalog">
      <div className="catalog-title">
        <h1>靶点</h1>
        <span>
          {visible.targets.length} 靶点 <i />{" "}
          {track === "computational"
            ? `${computationalPapers(visible).length} 篇论文${computationalPapers(visible).some((p) => p.disposition === "pending") ? "（含待核关联）" : ""}`
            : `${visible.molecules.filter(isProgram).length} 研发项目`}
        </span>
      </div>
      <div className="research-tabs" role="tablist" aria-label="靶点研究分类">
        <button
          role="tab"
          aria-selected={track === "development"}
          onClick={() => setTrack("development")}
        >
          实验与研发
        </button>
        <button
          role="tab"
          aria-selected={track === "computational"}
          onClick={() => setTrack("computational")}
        >
          计算设计
        </button>
      </div>
      <div className="filter-panel">
        <label className="catalog-search">
          <Search size={18} />
          <input
            aria-label={
              track === "computational"
                ? "搜索计算论文"
                : "搜索靶点、分子或公司"
            }
            placeholder={
              track === "computational"
                ? "搜索靶点、论文、方法或 DOI"
                : "搜索靶点、分子、公司或别名"
            }
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
          />
          {filters.query && (
            <button aria-label="清除搜索" onClick={() => update("query", "")}>
              <X size={15} />
            </button>
          )}
        </label>
        <div
          className={
            "catalog-filters" +
            (track === "computational" ? " paper-filters" : "")
          }
        >
          {track === "development" && (
            <>
              <label>
                <span>阶段</span>
                <select
                  aria-label="筛选阶段"
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
                <span>发现路线</span>
                <select
                  aria-label="筛选发现路线"
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
                  aria-label="筛选公司"
                  placeholder="公司名称或别名"
                  value={filters.company}
                  onChange={(e) => update("company", e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            <span>排序</span>
            <select
              aria-label="靶点排序"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
              }}
            >
              <option value="updated">
                {track === "computational" ? "论文最新发表" : "最近核查"}
              </option>
              <option value="count">
                {track === "computational"
                  ? "论文数量 多→少"
                  : "研发项目 多→少"}
              </option>
              <option value="name">名称 A–Z</option>
            </select>
          </label>
        </div>
      </div>
      <div className="result-line">
        <span role="status">
          {results.length} 个靶点
          {filtered &&
            track !== "computational" &&
            ` · ${results.reduce((n, r) => n + r.molecules.filter(isProgram).length, 0)} 个匹配项目`}
        </span>
        {filtered ? (
          <button
            className="reset-filter"
            onClick={() => {
              setFilters({ ...emptyFilters });
            }}
          >
            清除筛选 <X size={13} />
          </button>
        ) : track === "development" ? (
          <div className="stage-key">
            {buckets.map(([id, label, color]) => (
              <span key={id}>
                <i style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="catalog-grid">
        {results.map(
          ({
            target,
            molecules: matches,
            updated,
            filters: targetFilters,
          }) => {
            if (track === "computational") {
              const papers = computationalPapers(visible, target.id);
              return (
                <button
                  className={
                    "catalog-card computational-card" +
                    (targetIsRecent(state, target.id, undefined, track)
                      ? " recent-card"
                      : "")
                  }
                  key={target.id}
                  onClick={() => onSelect(target.id, targetFilters, track)}
                >
                  <div className="catalog-card-title">
                    <h2>{target.name}</h2>
                    {targetIsRecent(state, target.id, undefined, track) && (
                      <span className="recent-badge">近5天</span>
                    )}
                  </div>
                  <div className="target-metric">
                    <strong>{papers.length}</strong>
                    <span>篇论文</span>
                  </div>
                  <div className="catalog-card-bottom">
                    <span>
                      计算 / 结构指导
                      {papers.some((p) => p.disposition === "pending")
                        ? " · 含待核"
                        : ""}
                    </span>
                    <time>{updated}</time>
                  </div>
                </button>
              );
            }
            const molecules = matches.filter(isProgram);
            const researchCount = matches.length - molecules.length;
            const counts = [
              molecules.filter((m) =>
                ["design", "in-vitro", "preclinical"].includes(m.stage),
              ).length,
              molecules.filter((m) =>
                ["phase1", "phase2", "phase3", "filed"].includes(m.stage),
              ).length,
              molecules.filter((m) => m.stage === "approved").length,
            ];
            const companies = [
              ...new Set(molecules.flatMap((m) => m.companyIds)),
            ];
            return (
              <button
                className={
                  "catalog-card" +
                  (targetIsRecent(state, target.id, undefined, track)
                    ? " recent-card"
                    : "")
                }
                key={target.id}
                onClick={() => onSelect(target.id, targetFilters, track)}
              >
                <div className="catalog-card-title">
                  <h2>{target.name}</h2>
                  {targetIsRecent(state, target.id, undefined, track) && (
                    <span className="recent-badge">近5天</span>
                  )}
                  <ArrowUpRight size={19} />
                </div>
                <div className="target-metric">
                  <strong>{molecules.length}</strong>
                  <span>
                    研发项目
                    {researchCount > 0 && ` · ${researchCount} 研究分子`}
                  </span>
                </div>
                <div
                  className="phase-distribution"
                  aria-label={`临床前 ${counts[0]}，临床 ${counts[1]}，获批 ${counts[2]}，阶段未知 ${molecules.length - counts.reduce((a, b) => a + b, 0)}`}
                >
                  {counts.map(
                    (n, i) =>
                      n > 0 && (
                        <span
                          key={i}
                          style={{
                            width:
                              (100 * n) / Math.max(1, molecules.length) + "%",
                            background: buckets[i][2],
                          }}
                          title={`${buckets[i][1]} ${n}`}
                        />
                      ),
                  )}
                </div>
                <div className="phase-counts">
                  {counts.map((n, i) => (
                    <span key={i}>
                      {buckets[i][1]} <b>{n}</b>
                    </span>
                  ))}
                </div>
                <div className="catalog-card-bottom">
                  <span>
                    {companies.length} 公司 ·{" "}
                    {
                      state.series.filter((s) =>
                        molecules.some((m) => m.seriesId === s.id),
                      ).length
                    }{" "}
                    系列
                  </span>
                  <time>{updated}</time>
                </div>
              </button>
            );
          },
        )}
      </div>
      {!results.length && (
        <div className="filter-empty">
          <Search size={25} />
          <h3>没有匹配结果</h3>
          <button
            onClick={() => {
              setFilters({ ...emptyFilters });
            }}
          >
            清除筛选
          </button>
        </div>
      )}
    </section>
  );
}
