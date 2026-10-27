"""Source discovery helpers. Retrieval produces candidates and receipts, never verified scientific facts."""

import datetime as dt
import json
import urllib.request
import urllib.parse
from .store import key, now, Invalid

SCOPES = ("discovery", "optimization", "translation", "cmc", "clinical", "business")


def plan(name, aliases=(), kind="target"):
    if kind not in ("target", "company"):
        raise Invalid("调研入口须为 target 或 company")
    names = list(dict.fromkeys([name, *aliases]))
    term = " OR ".join('"' + n.replace('"', "") + '"' for n in names)
    peptide = "(peptide OR macrocyclic OR miniprotein OR 多肽 OR 环肽)"
    if kind == "target":
        queries = [
            ("discovery", f"({term}) {peptide} (discovery OR design OR display OR 发现 OR 筛选)"),
            (
                "discovery",
                f"({term}) (peptide OR minibinder OR macrocycle) (redesign OR hallucination OR motif grafting OR interface mimicry OR rational design)",
            ),
            (
                "discovery",
                f"({term}) (AfCycDesign OR RFpeptides OR BindCraft OR PepMimic OR Mirror-Peptidizer OR HFGuidedDesign OR AnewOmni OR ColabDesign OR ProteinMPNN OR Latent-X2)",
            ),
            (
                "optimization",
                f"({term}) {peptide} (SAR OR permeability OR pharmacokinetics OR 成药性)",
            ),
            ("translation", f"({term}) {peptide} (patent OR animal OR 专利 OR 临床前)"),
            (
                "cmc",
                f"({term}) {peptide} (synthesis OR manufacturing OR formulation OR 放大 OR 制剂)",
            ),
            ("clinical", f"({term}) {peptide} (trial OR approval OR 临床 OR 获批 OR 终止)"),
            ("business", f"({term}) {peptide} (license OR acquisition OR partnership)"),
            ("business", f"({term}) (口服肽 OR 环肽) (许可 OR 授权 OR 合作 OR 收购)"),
            ("translation", f"({term}) (patent OR 专利) (applicant OR assignee OR 申请人)"),
        ]
        bridge = {
            "skill": "peptide-company-research",
            "when": "发现新的申请人、公司、交易对手或资产代码；即使无论文也要反查双方公告、证券文件与后续履行",
            "inputs": [
                "targetId",
                "companyIds",
                "moleculeIds",
                "aliases",
                "sourceIds",
                "unresolvedQuestions",
            ],
            "boundary": "单靶点补查只跟该靶点资产；公司全多肽布局须为用户范围的一部分",
        }
        instructions = [
            "先声明物种、机制和中英文别名，从靶点独立发现未知公司/分子，不只搜索已有代号。",
            "论文/SI、专利、登记/监管与中英文产业线分别查；collect 两个接口不能替代企业与专利反查。",
            "计算研究需靶点到方法、方法到正文/SI靶点双向召回，核对旧表已知论文基准；不只搜标题和具名分子。",
            "逐个枚举已读来源中的编号；尚未读完的表/家族写缺口，检索成功不代表穷尽。",
        ]
    else:
        queries = [
            ("identity", f"({term}) (subsidiary OR former OR legal OR 子公司 OR 曾用名)"),
            ("portfolio", f"({term}) {peptide} (pipeline OR platform OR 管线 OR 平台)"),
            ("partnerships", f"({term}) {peptide} (license OR collaboration OR acquisition)"),
            ("partnerships", f"({term}) (多肽 OR 环肽 OR 口服肽) (合作 OR 授权 OR 许可 OR 收购)"),
            (
                "partnerships",
                f"({term}) (strategic collaboration OR platform access OR co-development OR technology licensing OR delivery OR manufacturing OR 战略合作 OR 平台许可 OR 联合研发 OR 递送 OR 制造)",
            ),
            (
                "partnerships",
                f"({term}) (partner OR investor OR annual report OR 合作伙伴 OR 投资组合 OR 年报)",
            ),
            ("patents", f"({term}) {peptide} (patent OR assignee OR 专利 OR 申请人)"),
            (
                "execution",
                f"({term}) {peptide} (closing OR payment OR termination OR amendment OR 交割 OR 付款 OR 终止 OR 修订)",
            ),
            (
                "capital",
                f"({term}) {peptide} (investment OR financing OR merger OR 投资 OR 融资 OR 合并)",
            ),
        ]
        bridge = {
            "skill": "peptide-target-research",
            "when": "公开多肽资产的受体、模态、临床代号或专利实施例映射需要技术核验",
            "inputs": [
                "companyIds",
                "moleculeIds",
                "aliases",
                "sourceIds",
                "patentFamilies",
                "unresolvedQuestions",
            ],
            "boundary": "只补指定资产的技术身份与阶段，不强制开展全部靶点 SAR 调研",
        }
        instructions = [
            "从公司中英文品牌和法律主体、管线/证券披露与专利申请人发现项目，不要求已有靶点。",
            "沿每笔交易的双方及新旧资产代码追查；公布、生效、交割、实付、融资和后续修订分开。",
            "既查具体多肽资产，也查多肽公司的技术平台、AI/筛选、递送、制造、联合研发和战略投资；不要求预先存在分子/靶点。",
            "平台名/公司旧名查询不强制出现peptide，原文确认多肽关联，并反查MNC伙伴年报。",
            "潜在金额不是到账，混合首付/近期里程碑合计不得当纯首付；未披露靶点的平台交易保留空关联。",
        ]
    return {
        kind: name,
        "kind": kind,
        "aliases": names[1:],
        "skill": "peptide-" + kind + "-research",
        "queries": [{"scope": k, "query": v} for k, v in queries],
        "bridge": bridge,
        "instructions": instructions
        + ["用同一来源/身份和 SQLite，实际查询才写 receipts；问题复用 gaps，不建立第二套事实。"],
        "execution": "计划待由当前 Codex 执行；未运行搜索或自动启动 agent",
    }


def fetch_json(url):
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "PeptideAtlas/0.1 source-discovery"},
    )
    with urllib.request.urlopen(req, timeout=35) as r:
        return json.load(r)


def collect(store, target_id, days=365, limit=30, pages=3):
    state = store.state()
    target = next((t for t in state["targets"] if t["id"] == target_id), None)
    if not target:
        raise Invalid("靶点不存在；先通过commit添加target身份")
    if not (1 <= days <= 36500 and 1 <= limit <= 100 and 1 <= pages <= 20):
        raise Invalid("days/limit/pages超出范围")
    today = dt.date.today().isoformat()
    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    names = [target["name"], *target.get("aliases", [])]
    molecules = [
        m
        for m in state["molecules"]
        if target_id in m["targetIds"]
        and m["stage"] in ("phase1", "phase2", "phase3", "filed", "approved")
    ]
    drug_names = sorted(
        set(n.strip() for m in molecules for n in [*m["name"].split("/"), *m.get("aliases", [])])
    )
    quoted = lambda xs: " OR ".join('"' + x.replace('"', "") + '"' for x in xs)
    term = quoted(names)
    abstract_names = " OR ".join("TITLE_ABS:" + n for n in quoted(names).split(" OR "))
    literature = (
        "(("
        + abstract_names
        + ") AND (TITLE_ABS:peptide OR TITLE_ABS:macrocyclic OR TITLE_ABS:miniprotein OR TITLE_ABS:minibinder))"
    )
    if drug_names:
        literature = (
            "("
            + literature
            + " OR "
            + " OR ".join("TITLE_ABS:" + n for n in quoted(drug_names).split(" OR "))
            + ")"
        )
    literature += " AND FIRST_PDATE:[" + since + " TO " + today + "] sort_date:y"
    # Registry intervention descriptions often contain only a drug code, without the word peptide.
    clinical = "(" + term + ")" + (" OR " + quoted(drug_names) if drug_names else "")
    queries = [
        (
            "Europe PMC",
            literature,
            {"query": literature, "format": "json", "resultType": "core", "pageSize": str(limit)},
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
        ),
        (
            "ClinicalTrials.gov",
            clinical,
            {
                "format": "json",
                "pageSize": str(limit),
                "query.term": clinical,
                "sort": "LastUpdatePostDate:desc",
                "countTotal": "true",
            },
            "https://clinicaltrials.gov/api/v2/studies",
        ),
    ]
    reports = []
    for tool, query, params, base in queries:
        rid = "search-" + key(target_id, tool, query, now())
        responses = []
        count = 0
        cursor = "*" if tool == "Europe PMC" else None
        total = None
        error = None
        more = False
        receipt = {
            "id": rid,
            "targetIds": [target_id],
            "query": query,
            "tool": tool,
            "date": today,
            "status": "success",
            "limit": limit,
            "maxPages": pages,
            "since": since if tool == "Europe PMC" else None,
            "note": "仅候选发现；登记库按别名全历史检索，尚未逐条判定相关性。专利、CMC全文及产业须另补检索。",
        }
        for page in range(pages):
            args = dict(params)
            if tool == "Europe PMC":
                args["cursorMark"] = cursor
            elif cursor:
                args["pageToken"] = cursor
            url = base + "?" + urllib.parse.urlencode(args)
            try:
                result = fetch_json(url)
                responses.append(result)
                records = (
                    result.get("resultList", {}).get("result", [])
                    if tool == "Europe PMC"
                    else result.get("studies", [])
                )
                count += len(records)
                total = (
                    result.get("hitCount", total)
                    if tool == "Europe PMC"
                    else result.get("totalCount", total)
                )
                next_cursor = (
                    result.get("nextCursorMark")
                    if tool == "Europe PMC"
                    else result.get("nextPageToken")
                )
                more = bool(
                    records
                    and next_cursor
                    and next_cursor != cursor
                    and (total is None or count < total)
                )
                if not more:
                    break
                cursor = next_cursor
            except Exception as exc:
                error = str(exc)[:500]
                break
        receipt.update(
            count=count,
            totalHits=total,
            pagesFetched=len(responses),
            truncated=more,
            nextCursor=cursor if more else None,
            url=base + "?" + urllib.parse.urlencode(params),
        )
        if error:
            receipt.update(status="partial" if responses else "failed", error=error)
        elif more:
            receipt["status"] = "partial"
        if responses:
            (store.root / "raw").mkdir(exist_ok=True)
            filename = rid + ".json"
            (store.root / "raw" / filename).write_text(
                json.dumps(responses, ensure_ascii=False), encoding="utf-8"
            )
            receipt["rawFile"] = filename
        reports.append(receipt)
    return store.commit(
        {
            "baseRevision": store.state()["revision"],
            "reviewer": "公开接口采集（未做科学核实）",
            "records": {"receipts": reports},
        }
    )
