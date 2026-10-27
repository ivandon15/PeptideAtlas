"""Publish an explicitly scoped, field-allowlisted view; never copy a runtime database."""

import copy
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from .store import Invalid, now, stable
from .editorial import violations

BASELINE = Path(__file__).resolve().parents[1] / "data" / "pilot.json"
BASE_FIELDS = "id name aliases description"
FIELDS = {
    "targets": BASE_FIELDS,
    "companies": BASE_FIELDS + " canonicalCompanyId",
    "sources": "id title url kind access checkedAt publishedAt readScope disposition relevanceReason documentGroup doi",
    "series": BASE_FIELDS
    + " targetIds sourceIds companyIds origin basis researchFocus researchFocusNote",
    "molecules": BASE_FIELDS
    + " targetIds seriesId sourceIds companyIds origin stage status asOf modality recordLevel sequence sequenceNote specificity stageEvidenceIds trackingRole trackingRoleNote",
    "evidence": "id title summary sourceId locator moleculeIds seriesIds companyIds dealIds date line verification outcome validationLevel topic shortLabel region indication stageClaim statusClaim statusAsOf candidateClaim assay",
    "relations": "id from to type sourceId locator reason verification",
    "deals": BASE_FIELDS
    + " fromCompanyId toCompanyId sourceIds targetIds moleculeIds seriesIds date announcedAt signedPeriod eventKind acquisitionScope stageAtSigning rationale locator rights contributions upfront paid potentialMilestones potentialTotal financialSummary financialNotes financialScope payments",
    "gaps": "id title reason requested reasonType urls sourceIds targetIds moleculeIds seriesIds companyIds dealIds status",
    "observations": "id title asOf coverage summary interpretation uncertainty nextCheck status sourceIds evidenceIds dealIds targetIds companyIds moleculeIds seriesIds",
}
NESTED_FIELDS = {
    "assay": "metric value unit relation context",
    "rationale": "kind text",
    "upfront": "value currency",
    "paid": "value currency",
    "potentialMilestones": "value currency",
    "potentialTotal": "value currency",
    "payments": "kind date amount note sourceId locator",
    "amount": "value currency",
}
SENSITIVE = re.compile(
    r"/(?:Users|home)/[^/\s]+/|[A-Z]:\\Users\\|file://|"
    r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|"
    r"(?:gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9]{30,})|"
    r"我司|我们公司|仅供内部|内部会议|保密资料"
)


def project(record, fields):
    result = {key: copy.deepcopy(record[key]) for key in fields.split() if key in record}
    for key, value in result.items():
        if key in NESTED_FIELDS and isinstance(value, dict):
            result[key] = project(value, NESTED_FIELDS[key])
        elif key in NESTED_FIELDS and isinstance(value, list):
            result[key] = [project(item, NESTED_FIELDS[key]) for item in value]
    return result


def check_public_text(records):
    """Fail with record IDs, never echo the possibly private matching text."""
    copy_issues = violations(records)
    if copy_issues:
        raise Invalid("展示文案需直接陈述事实：" + ", ".join(copy_issues[:8]))

    def contains_private(value):
        if isinstance(value, str):
            return bool(SENSITIVE.search(value))
        if isinstance(value, dict):
            return any(contains_private(item) for item in value.values())
        if isinstance(value, list):
            return any(contains_private(item) for item in value)
        return False

    for kind, rows in records.items():
        for row in rows:
            if contains_private(row):
                raise Invalid(f"公开导出发现疑似个人/内部内容：{kind}/{row['id']}；请先人工核对")
    for source in records["sources"]:
        url = urlparse(source["url"])
        if url.scheme != "https" or url.username or url.password:
            raise Invalid("公开来源必须为无凭据的HTTPS链接：" + source["id"])
        if {key.lower() for key in parse_qs(url.query)} & {
            "token",
            "access_token",
            "api_key",
            "password",
        }:
            raise Invalid("公开来源链接包含凭据参数：" + source["id"])


def public_snapshot(state, observation_ids=(), baseline=None):
    baseline = (
        baseline if baseline is not None else json.loads(BASELINE.read_text(encoding="utf-8"))
    )
    records = {}
    for kind, fields in FIELDS.items():
        allowed = (
            set(observation_ids)
            if kind == "observations"
            else {r["id"] for r in baseline.get(kind, [])}
        )
        rows = []
        for row in state.get(kind, []):
            if row["id"] not in allowed:
                continue
            if kind == "observations" and row["status"] != "active":
                raise Invalid("待复核或撤回的观察不能公开：" + row["id"])
            if kind == "gaps" and row["status"] in ("resolved", "unobtainable"):
                continue
            value = project(row, fields)
            if kind == "gaps":
                value["status"] = "needs-material"
            rows.append(value)
        records[kind] = sorted(rows, key=lambda r: r["id"])
    if set(observation_ids) - {r["id"] for r in records["observations"]}:
        raise Invalid("所选公开观察不存在")
    # Missing references stop publication; never pull private neighboring entities into the export.
    refs = {kind: {row["id"] for row in rows} for kind, rows in records.items()}
    relation_fields = {
        "targetIds": "targets",
        "companyIds": "companies",
        "moleculeIds": "molecules",
        "seriesIds": "series",
        "sourceIds": "sources",
        "stageEvidenceIds": "evidence",
        "evidenceIds": "evidence",
        "dealIds": "deals",
    }
    for kind, rows in records.items():
        for row in rows:
            for field, target in relation_fields.items():
                if field in row and not set(row[field]) <= refs[target]:
                    raise Invalid(f"公开范围缺少关联：{kind}/{row['id']}/{field}；先整理公开基线")
            for field, target in {
                "sourceId": "sources",
                "seriesId": "series",
                "fromCompanyId": "companies",
                "toCompanyId": "companies",
                "canonicalCompanyId": "companies",
            }.items():
                if row.get(field) and row[field] not in refs[target]:
                    raise Invalid(f"公开范围缺少关联：{kind}/{row['id']}/{field}")
            if kind == "relations" and (
                row["from"] not in refs["molecules"] or row["to"] not in refs["molecules"]
            ):
                raise Invalid("公开范围缺少关系端点：" + row["id"])
    check_public_text(records)
    return {
        "schemaVersion": 1,
        "publishedAt": now(),
        "dataVersion": hashlib.sha256(stable(records).encode()).hexdigest()[:16],
        "records": records,
    }


def export_public(store, output, observation_ids=()):
    snapshot = public_snapshot(store.state(), observation_ids)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(output)
    return {
        "output": str(output),
        "dataVersion": snapshot["dataVersion"],
        "counts": {k: len(v) for k, v in snapshot["records"].items()},
    }
