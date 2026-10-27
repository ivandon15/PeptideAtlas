import type { State, Molecule } from "./model";
import {
  documentKey,
  researchSources,
  hasExperiment,
  computationalPapers,
} from "./research-view";
import { ExternalLink, ChevronRight } from "lucide-react";
export function ComputationalTarget({
  state,
  targetId,
  onOpen,
  memberLabel = "已收录设计与实验",
}: {
  state: State;
  targetId: string;
  onOpen: (m: Molecule) => void;
  memberLabel?: string;
}) {
  const molecules = state.molecules.filter((m) =>
    m.targetIds.includes(targetId),
  );
  const papers = computationalPapers(state, targetId);
  return (
    <div className="computational-papers">
      {papers.map((p) => {
        const members = molecules.filter((m) =>
          researchSources(state, [m]).some(
            (x) => documentKey(x) === documentKey(p),
          ),
        );
        const studies = state.series.filter(
          (x) => x.targetIds.includes(targetId) && x.sourceIds.includes(p.id),
        );
        const studyEvidence = state.evidence.filter(
          (e) =>
            e.sourceId === p.id &&
            e.seriesIds?.some((id) => studies.some((x) => x.id === id)),
        );
        const labels: Record<string, string> = {
          "in-vitro": "论文报道体外实验",
          "in-vivo": "论文报道动物实验",
          "not-detected": "已测试 · 未检出结合",
          "computational-only": "计算评估",
          uncertain: "关联待核",
        };
        const levels = [
          ...new Set(
            studyEvidence.map((e) => e.validationLevel).filter(Boolean),
          ),
        ] as string[];
        return (
          <article className="paper-card" key={p.id}>
            <div className="card-kicker">
              <span>{p.publishedAt || "日期未确认"}</span>
              {p.disposition === "pending" ? (
                <span className="tag">靶点关联待核</span>
              ) : levels.length ? (
                levels.map((level) => (
                  <span className="tag" key={level}>
                    {labels[level]}
                  </span>
                ))
              ) : (
                <span className="tag">
                  {members.some((m) => hasExperiment(state, m))
                    ? "含实验验证"
                    : "验证范围待核"}
                </span>
              )}
              <span className="tag">
                {p.access === "full"
                  ? "已读原文"
                  : p.access === "abstract"
                    ? "仅摘要"
                    : p.access === "metadata"
                      ? "仅元数据"
                      : "已读部分原文"}
              </span>
            </div>
            <h2>
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.title} <ExternalLink size={14} />
              </a>
            </h2>
            {studies.map((x) => (
              <div className="study-summary" key={x.id}>
                <strong>{x.name}</strong>
                <p>{x.description}</p>
              </div>
            ))}
            <details>
              <summary>读取范围与核查依据</summary>
              <p className="muted">{p.readScope}</p>
              {studyEvidence.map((e) => (
                <small key={e.id}>{e.locator}</small>
              ))}
            </details>
            {members.length > 0 && (
              <details>
                <summary>
                  {memberLabel} · {members.length} 条
                </summary>
                <div className="paper-members">
                  {members.map((m) => (
                    <button key={m.id} onClick={() => onOpen(m)}>
                      {m.name}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              </details>
            )}
          </article>
        );
      })}
      {!papers.length && <p className="muted">尚未关联论文来源</p>}
    </div>
  );
}
