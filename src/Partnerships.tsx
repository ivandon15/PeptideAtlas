import { useState } from "react";
import {
  Search,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import type { State, Molecule, Deal } from "./model";
import { stageLabel, statusLabel } from "./model";
import {
  eventKind,
  eventLabels,
  dealDate,
  emptyDealFilters,
  filterDeals,
  companyAssets,
  type DealFilters,
} from "./business";
import { isRecent } from "./summary-data";
import "./partnerships.css";
const money = (m: Deal["upfront"]) =>
  m
    ? new Intl.NumberFormat("en", {
        style: "currency",
        currency: m.currency,
        notation: "compact",
        maximumFractionDigits: 3,
      }).format(m.value)
    : "未披露";
export function Partnerships({
  state: s,
  onMolecule,
  onTarget,
  initialQuery = "",
}: {
  state: State;
  initialQuery?: string;
  onMolecule: (m: Molecule) => void;
  onTarget: (id: string) => void;
}) {
  const [filters, setFilters] = useState({
      ...emptyDealFilters,
      query: initialQuery,
    }),
    [sort, setSort] = useState("newest"),
    [companyId, setCompanyId] = useState(""),
    [companyQuery, setCompanyQuery] = useState(""),
    [overviewFilters, setOverviewFilters] = useState({ ...emptyDealFilters });
  const openCompany = (id: string) => {
    if (!companyId) setOverviewFilters(filters);
    setFilters({ ...emptyDealFilters });
    setCompanyId(id);
  };
  const update = (k: keyof DealFilters, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
  };
  const reset = () => {
    setFilters({ ...emptyDealFilters });
  };
  const company = s.companies.find((c) => c.id === companyId),
    assets = company ? companyAssets(s, company.id) : [];
  const results = filterDeals(
    s,
    {
      ...filters,
      company: companyId || filters.company,
    },
    sort,
  );
  const companyNames = s.companies.filter(
    (c) =>
      !c.canonicalCompanyId &&
      [c.name, ...(c.aliases || [])]
        .join(" ")
        .toLowerCase()
        .includes(companyQuery.toLowerCase()),
  );
  const sourceLink = (id: string) => {
    const source = s.sources.find((x) => x.id === id);
    return (
      source && (
        <a key={id} href={source.url} target="_blank" rel="noreferrer">
          {source.title}
          <ExternalLink size={12} />
        </a>
      )
    );
  };
  const companyButton = (id: string) => (
    <button
      className="company-link"
      onClick={() => {
        openCompany(id);
      }}
    >
      {s.companies.find((c) => c.id === id)?.name || id}
    </button>
  );
  return (
    <section className="partnerships">
      {company && (
        <button
          className="back"
          onClick={() => {
            setCompanyId("");
            setFilters(overviewFilters);
          }}
        >
          <ArrowLeft size={15} />
          合作总览
        </button>
      )}
      <div className="catalog-title">
        <h1>{company ? company.name : "合作总览"}</h1>
        <span>
          {company ? `${assets.length} 关联资产` : `${s.deals.length} 商业事件`}
        </span>
      </div>
      {company && (
        <div className="company-portfolio">
          <div className="section-heading">
            <h2>资产组合</h2>
            <span>
              {
                s.deals.filter((d) =>
                  [d.fromCompanyId, d.toCompanyId].includes(companyId),
                ).length
              }{" "}
              合作事件
            </span>
          </div>
          {assets.length ? (
            <div className="portfolio-grid">
              {assets.map((m) => (
                <button
                  className="portfolio-asset"
                  key={m.id}
                  onClick={() => onMolecule(m)}
                >
                  <strong>
                    {m.name}
                    <ChevronRight size={14} />
                  </strong>
                  <span>
                    {m.targetIds
                      .map((id) => s.targets.find((t) => t.id === id)?.name)
                      .join(" · ")}
                  </span>
                  <div>
                    <b>{stageLabel[m.stage]}</b>
                    <small>{statusLabel[m.status]}</small>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">暂无已关联的具体分子</p>
          )}
        </div>
      )}
      <div className="filter-panel">
        <label className="catalog-search">
          <Search size={17} />
          <input
            aria-label="搜索合作"
            placeholder="公司、资产、靶点或别名"
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
          />
          {filters.query && (
            <button
              aria-label="清除合作搜索"
              onClick={() => update("query", "")}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <div className="deal-filters">
          {!company && (
            <details className="company-picker">
              <summary>
                {filters.company
                  ? s.companies.find((c) => c.id === filters.company)?.name
                  : "全部公司"}
              </summary>
              <div>
                <input
                  aria-label="搜索筛选公司"
                  placeholder="搜索公司或别名"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                />
                <select
                  aria-label="筛选合作公司"
                  size={6}
                  value={filters.company}
                  onChange={(e) => {
                    update("company", e.target.value);
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    setCompanyQuery("");
                  }}
                >
                  <option value="">全部公司</option>
                  {companyNames.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </details>
          )}
          <select
            aria-label="筛选合作靶点"
            value={filters.target}
            onChange={(e) => update("target", e.target.value)}
          >
            <option value="">全部靶点</option>
            <option value="undisclosed">未披露靶点</option>
            {s.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            aria-label="筛选事件类型"
            value={filters.kind}
            onChange={(e) => update("kind", e.target.value)}
          >
            <option value="">全部事件</option>
            {Object.entries(eventLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="签约时阶段"
            value={filters.stage}
            onChange={(e) => update("stage", e.target.value)}
          >
            <option value="">签约时阶段</option>
            <option value="early">发现 / 临床前</option>
            <option value="clinical">临床</option>
            <option value="approved">获批 / 上市</option>
          </select>
        </div>
        <details className="more-deal-filters">
          <summary>时间与地域</summary>
          <div>
            <label>
              起始月份
              <input
                aria-label="合作起始月份"
                type="month"
                value={filters.since}
                onChange={(e) => update("since", e.target.value)}
              />
            </label>
            <label>
              截止月份
              <input
                aria-label="合作截止月份"
                type="month"
                value={filters.until}
                onChange={(e) => update("until", e.target.value)}
              />
            </label>
            <label>
              权益地域
              <input
                aria-label="合作地域"
                placeholder="搜索权益原文，如：全球、台湾"
                value={filters.region}
                onChange={(e) => update("region", e.target.value)}
              />
            </label>
          </div>
        </details>
      </div>
      <div className="result-line">
        <label className="result-sort">
          <span>排序</span>
          <select
            aria-label="合作排序"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">事件时间 近→远</option>
            <option value="oldest">事件时间 远→近</option>
            <option value="name">名称 A–Z</option>
          </select>
        </label>
        <span role="status">
          {results.length} 项{company ? "合作事件" : "匹配事件"}
        </span>
        {!company && filters.company && (
          <button
            className="back"
            onClick={() => {
              openCompany(filters.company);
            }}
          >
            公司档案 <ChevronRight size={14} />
          </button>
        )}
        {Object.values(filters).some(Boolean) && (
          <button className="reset-filter" onClick={reset}>
            清除筛选
            <X size={12} />
          </button>
        )}
      </div>
      <div className={company ? "business-timeline" : "business-events"}>
        {results.map((d) => (
          <article
            className={
              "business-event" + (isRecent(dealDate(d)) ? " recent-card" : "")
            }
            key={d.id}
          >
            <div className="event-meta">
              {isRecent(dealDate(d)) && (
                <span className="recent-badge">近5天</span>
              )}
              <time
                title={
                  d.date || d.signedPeriod ? "签约 / 事件日期" : "公告日期"
                }
              >
                {dealDate(d) || "日期未披露"}
              </time>
              <span className={"event-type type-" + eventKind(d)}>
                {d.acquisitionScope === "company"
                  ? "公司收购"
                  : eventLabels[eventKind(d)]}
              </span>
              {/待交割|拟反向合并/.test(d.name) && (
                <span className="event-type">
                  {d.name.includes("待交割") ? "待交割" : "拟议"}
                </span>
              )}
              <small>{d.stageAtSigning}</small>
            </div>
            <div className="event-partners">
              {companyButton(d.fromCompanyId)}
              <ArrowRight size={15} />
              {companyButton(d.toCompanyId)}
            </div>
            <div className="event-assets">
              {d.moleculeIds?.length ? (
                d.moleculeIds.map((id) => {
                  const m = s.molecules.find((m) => m.id === id);
                  return (
                    m && (
                      <button key={id} onClick={() => onMolecule(m)}>
                        {m.name}
                        <ChevronRight size={12} />
                      </button>
                    )
                  );
                })
              ) : (
                <strong>{d.name}</strong>
              )}
              {d.targetIds?.length ? (
                d.targetIds.map((id) => (
                  <button
                    className="target-token"
                    key={id}
                    onClick={() => onTarget(id)}
                  >
                    {s.targets.find((t) => t.id === id)?.name}
                  </button>
                ))
              ) : (
                <span className="target-token">靶点未披露</span>
              )}
            </div>
            {d.financialSummary && (
              <p className="event-money">{d.financialSummary}</p>
            )}
            {!d.financialSummary && d.acquisitionScope === "company" && (
              <p className="event-money">{d.financialScope}</p>
            )}
            {!d.financialSummary &&
              !["investment", "merger"].includes(eventKind(d)) &&
              d.acquisitionScope !== "company" && (
                <div className="event-money">
                  <span>
                    首付约定 <strong>{money(d.upfront)}</strong>
                  </span>
                  <span>
                    已付首款 <strong>{money(d.paid)}</strong>
                  </span>
                  {d.potentialMilestones && (
                    <span>
                      潜在里程碑 <strong>{money(d.potentialMilestones)}</strong>
                    </span>
                  )}
                </div>
              )}
            <details className="event-details">
              <summary>
                条款与证据
                <ChevronRight size={14} />
              </summary>
              <h3>{d.name}</h3>
              {d.announcedAt && <small>公告 {d.announcedAt}</small>}
              <div className="event-detail-columns">
                <div>
                  <h4>权益与责任</h4>
                  <p>{d.rights}</p>
                  <p>{d.contributions}</p>
                </div>
                <div>
                  <h4>
                    合作原因 ·{" "}
                    {d.rationale.kind === "official"
                      ? "官方披露"
                      : d.rationale.kind === "analysis"
                        ? "分析"
                        : "未披露"}
                  </h4>
                  <p>{d.rationale.text}</p>
                </div>
              </div>
              <p>{d.financialNotes}</p>
              {d.potentialTotal && (
                <p>
                  潜在总额 {money(d.potentialTotal)} ·{" "}
                  {d.financialScope || "整项合作"}
                </p>
              )}
              {d.payments?.map((p, i) => (
                <div className="payment-detail" key={i}>
                  <strong>{money(p.amount)}</strong>
                  <span>{p.date || "支付日未披露"}</span>
                  <p>{p.note}</p>
                  {sourceLink(p.sourceId)}
                  <small>{p.locator}</small>
                </div>
              ))}
              <div className="event-sources">{d.sourceIds.map(sourceLink)}</div>
              <small>定位：{d.locator}</small>
            </details>
          </article>
        ))}
      </div>
      {!results.length && (
        <div className="filter-empty">
          <Search size={23} />
          <h3>没有匹配事件</h3>
          <button onClick={reset}>清除筛选</button>
        </div>
      )}
    </section>
  );
}
