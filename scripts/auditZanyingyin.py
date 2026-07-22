# -*- coding: utf-8 -*-
"""对照 members_export 审计簪缨引条目，列出库中查无的臆造人员。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEMBERS_PATH = ROOT / "database" / "members_export.json"
ZYY_PATH = ROOT / "utils" / "zanyingyinHonor.js"


def load_members():
    members = json.loads(MEMBERS_PATH.read_text(encoding="utf-8"))
    by_id: dict[str, dict] = {}
    by_name: dict[str, list] = {}
    for m in members:
        mid = str(m.get("memberId") or m.get("originalId") or m.get("_id") or "")
        oid = str(m.get("originalId") or "")
        did = str(m.get("_id") or "")
        for k in {mid, oid, did}:
            if k:
                by_id[k] = m
        name = str(m.get("name") or "").strip()
        if not name:
            continue
        bare = name[1:] if name.startswith("罗") else name
        for key in {name, bare, f"罗{bare}" if bare else ""}:
            if key:
                by_name.setdefault(key, []).append(m)
    return members, by_id, by_name


def parse_array(js: str, var_name: str) -> list[dict]:
    m = re.search(rf"const {var_name}\s*=\s*\[", js)
    if not m:
        return []
    start = m.end() - 1
    depth = 0
    end = None
    for i in range(start, len(js)):
        ch = js[i]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        return []
    block = js[start:end]
    objs = []
    for om in re.finditer(r"\{[^{}]*\}", block, re.S):
        chunk = om.group(0)

        def field(key: str):
            mm = re.search(
                rf"{key}\s*:\s*(?:'([^']*)'|\"([^\"]*)\"|null|(-?\d+))",
                chunk,
            )
            if not mm:
                return None
            if mm.group(1) is not None:
                return mm.group(1)
            if mm.group(2) is not None:
                return mm.group(2)
            if mm.group(3) is not None:
                return int(mm.group(3))
            return None

        objs.append(
            {
                "id": field("id"),
                "name": field("name"),
                "generation": field("generation"),
                "dynasty": field("dynasty"),
                "title": field("title"),
                "memberDocId": field("memberDocId"),
            }
        )
    return objs


def resolve(entry, by_id, by_name):
    mid = entry.get("memberDocId")
    name = entry.get("name") or ""
    bare = name[1:] if name.startswith("罗") else name
    cands = by_name.get(name) or by_name.get(bare) or by_name.get(f"罗{bare}") or []

    if mid:
        m = by_id.get(str(mid))
        if m:
            return "ok_id", m, cands
        if cands:
            return "bad_id_name_exists", None, cands
        return "missing", None, []

    gen = entry.get("generation")
    if gen is not None and cands:
        gmatch = [c for c in cands if c.get("generation") == gen]
        if len(gmatch) == 1:
            return "ok_name_gen", gmatch[0], gmatch
        if len(gmatch) > 1:
            return "ambiguous_name_gen", gmatch[0], gmatch
    if len(cands) == 1:
        return "ok_name", cands[0], cands
    if len(cands) > 1:
        return "ambiguous_name", cands[0], cands
    return "missing", None, []


def main():
    members, by_id, by_name = load_members()
    js = ZYY_PATH.read_text(encoding="utf-8")
    sages = parse_array(js, "ZANYINGYIN_SAGES")
    edu = parse_array(js, "ZANYINGYIN_EDUCATION")
    print(f"members={len(members)} sages={len(sages)} edu={len(edu)}")

    remove_ids = []
    fix_rows = []

    for label, rows in (("SAGE", sages), ("EDU", edu)):
        print(f"\n=== {label} ===")
        for e in rows:
            st, m, cands = resolve(e, by_id, by_name)
            db = f"{m.get('name')}/{m.get('memberId')}" if m else "-"
            action = "KEEP"
            if st == "missing":
                action = "REMOVE"
                remove_ids.append(e.get("id"))
            elif st == "bad_id_name_exists":
                action = "FIX_ID"
                fix_rows.append(
                    (
                        e.get("id"),
                        e.get("name"),
                        e.get("memberDocId"),
                        [c.get("memberId") for c in cands[:5]],
                    )
                )
            print(
                f"{action:8} {st:22} {e.get('id')} | {e.get('name')} "
                f"gen={e.get('generation')} title={e.get('title')} "
                f"id={e.get('memberDocId')} -> {db}"
            )

    print(f"\nREMOVE count={len(remove_ids)}")
    for rid in remove_ids:
        print(" ", rid)
    if fix_rows:
        print("\nFIX_ID (id 无效但同名存在):")
        for row in fix_rows:
            print(" ", row)


if __name__ == "__main__":
    main()
