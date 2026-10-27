"""Keep process narration and stock defensive copy out of display records."""

import re

# Deliberately narrow: scientific negatives and uncertainty remain valid facts.
UNWANTED = re.compile(
    r"本轮|这一轮|本次(?:补录|检索|核查)|不是(?:收购|公司收购)|"
    r"不代表(?:全行业|全库)|已收录不等于|不能据已有|不能当作|先完成标签基线"
)
DISPLAY_KINDS = {
    "targets",
    "companies",
    "sources",
    "series",
    "molecules",
    "evidence",
    "relations",
    "deals",
    "gaps",
    "observations",
}
TEXT_FIELDS = {
    "name",
    "title",
    "description",
    "summary",
    "reason",
    "requested",
    "readScope",
    "relevanceReason",
    "sequenceNote",
    "specificity",
    "indication",
    "researchFocusNote",
    "locator",
    "stageAtSigning",
    "rationale",
    "contributions",
    "rights",
    "financialSummary",
    "financialNotes",
    "financialScope",
    "payments",
    "coverage",
    "interpretation",
    "uncertainty",
    "nextCheck",
    "assay",
}


def violations(records):
    """Return locations only; leave receipts, reviews and archived questions intact."""

    def matches(value):
        if isinstance(value, str):
            return bool(UNWANTED.search(value))
        if isinstance(value, dict):
            return any(matches(v) for v in value.values())
        if isinstance(value, list):
            return any(matches(v) for v in value)
        return False

    return [
        f"{kind}/{row['id']}/{field}"
        for kind, rows in records.items()
        if kind in DISPLAY_KINDS
        for row in rows
        if not (kind == "gaps" and row.get("status") in ("resolved", "unobtainable"))
        for field, value in row.items()
        if field in TEXT_FIELDS and matches(value)
    ]
