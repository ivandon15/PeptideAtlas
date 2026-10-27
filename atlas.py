#!/usr/bin/env python3
"""Local collaboration CLI; use --help. No OpenAI key or hosted account is required by the workbench."""

import argparse
import json
import sys
from pathlib import Path
from server.store import Store, Invalid, Conflict
from server.research import plan, collect


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data-dir", help="独立私有数据库与文件目录")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("init")
    sub.add_parser("state")
    sub.add_parser("pending")
    sub.add_parser("skills")
    s = sub.add_parser("export-public", help="按公开基线范围与字段白名单导出只读快照，不复制数据库")
    s.add_argument("output", help="导出JSON路径；发布前审阅差异")
    s.add_argument(
        "--observation", action="append", default=[], help="逐项指定已审阅可公开的观察ID"
    )
    s = sub.add_parser("serve")
    s.add_argument("--port", type=int, default=8766)
    s = sub.add_parser("plan")
    entry = s.add_mutually_exclusive_group(required=True)
    entry.add_argument("--target")
    entry.add_argument("--company")
    s.add_argument("--alias", action="append", default=[])
    s = sub.add_parser("collect")
    s.add_argument("--target-id", required=True)
    s.add_argument("--days", type=int, default=365)
    s.add_argument("--limit", type=int, default=30)
    s.add_argument("--pages", type=int, default=3)
    s = sub.add_parser("commit")
    s.add_argument("file", help="结构化更新JSON，包含baseRevision和reviewer")
    s = sub.add_parser("upload")
    s.add_argument("--gap-id", required=True)
    s.add_argument("file")
    s = sub.add_parser("packet")
    s.add_argument("gap_id")
    s = sub.add_parser("history")
    s.add_argument("kind")
    s.add_argument("id")
    a = p.parse_args()
    if a.command == "skills":
        result = [
            {"name": name, "entry": ".agents/skills/" + name + "/SKILL.md"}
            for name in (
                "peptide-target-research",
                "peptide-company-research",
                "peptide-intelligence-synthesis",
                "peptide-evidence-update",
            )
        ]
    elif a.command == "plan":
        result = plan(a.target or a.company, a.alias, "target" if a.target else "company")
    else:
        store = Store(a.data_dir)
        if a.command == "serve":
            from server.http import serve

            serve(store, a.port)
            return
        if a.command in ("init", "state"):
            result = store.state()
        elif a.command == "pending":
            state = store.state()
            result = {
                "revision": state["revision"],
                "gaps": [
                    g for g in state["gaps"] if g["status"] not in ("resolved", "unobtainable")
                ],
            }
        elif a.command == "commit":
            result = store.commit(json.loads(Path(a.file).read_text(encoding="utf-8")))
        elif a.command == "upload":
            result = store.add_upload(a.gap_id, Path(a.file).name, Path(a.file).read_bytes())
        elif a.command == "packet":
            result = store.packet(a.gap_id)
        elif a.command == "history":
            result = store.history(a.kind, a.id)
        elif a.command == "collect":
            if not 1 <= a.limit <= 100 or not 1 <= a.days <= 36500:
                raise Invalid("limit需1–100，days需1–36500")
            result = collect(store, a.target_id, a.days, a.limit, a.pages)
        elif a.command == "export-public":
            from server.publication import export_public

            result = export_public(store, a.output, a.observation)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (Invalid, ValueError, OSError, KeyError, TypeError) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
