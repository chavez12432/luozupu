# -*- coding: utf-8 -*-
"""将簪缨引荣誉里的旧云文档 _id 映射为新 memberId（M#### / C####）。"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / "database" / "_backup_personnel_20260719_132911" / "members_export.json"
NEW = ROOT / "database" / "members_export.json"
FILES = [
    ROOT / "utils" / "zanyingyinHonor.js",
    ROOT / "cloudfunctions" / "adminApi" / "zanyingyinHonor.js",
]


def build_id_map():
    old = json.loads(OLD.read_text(encoding="utf-8"))
    new = json.loads(NEW.read_text(encoding="utf-8"))
    old_by_id = {m["_id"]: m for m in old}
    new_key = defaultdict(list)
    for m in new:
        new_key[(m["name"], int(m.get("generation") or 0))].append(m)

    id_map = {}
    for hid, om in old_by_id.items():
        key = (om["name"], int(om.get("generation") or 0))
        cands = new_key.get(key, [])
        if len(cands) == 1:
            id_map[hid] = cands[0]["memberId"]
        elif len(cands) > 1:
            prefer = [c for c in cands if c.get("branch") == om.get("branch")]
            id_map[hid] = (prefer or cands)[0]["memberId"]
        else:
            byname = [m for m in new if m["name"] == om["name"]]
            if len(byname) == 1:
                id_map[hid] = byname[0]["memberId"]

    unique_ng = {k: v[0]["memberId"] for k, v in new_key.items() if len(v) == 1}
    return id_map, unique_ng


def remap_file(path, id_map, unique_ng):
    text = path.read_text(encoding="utf-8")
    replaced = 0
    filled = 0

    entry_re = re.compile(
        r"(\{\s*id:\s*'[^']+',\s*name:\s*'([^']*)',\s*generation:\s*(\d+),.*?memberDocId:\s*)"
        r"('([^']*)'|null)",
        re.S,
    )

    def repl(m):
        nonlocal replaced, filled
        prefix, name, gen, whole, hid = (
            m.group(1),
            m.group(2),
            int(m.group(3)),
            m.group(4),
            m.group(5),
        )
        if whole != "null" and hid:
            new_id = id_map.get(hid)
            if new_id:
                replaced += 1
                return f"{prefix}'{new_id}'"
            return m.group(0)
        nid = unique_ng.get((name, gen))
        if nid:
            filled += 1
            return f"{prefix}'{nid}'"
        return m.group(0)

    new_text = entry_re.sub(repl, text)
    for old_id, new_id in id_map.items():
        needle = f"'{old_id}'"
        if needle in new_text:
            cnt = new_text.count(needle)
            new_text = new_text.replace(needle, f"'{new_id}'")
            replaced += cnt

    path.write_text(new_text, encoding="utf-8")
    left = re.findall(r"memberDocId:\s*'([0-9a-f]{16,})'", new_text)
    nulls = len(re.findall(r"memberDocId:\s*null", new_text))
    m_ids = re.findall(r"memberDocId:\s*'(M\d+|C\d+)'", new_text)
    return {
        "file": path.name,
        "replaced": replaced,
        "filled_null": filled,
        "left_hashes": left,
        "nulls": nulls,
        "new_ids": len(m_ids),
    }


def main():
    id_map, unique_ng = build_id_map()
    print(f"old->_new map size: {len(id_map)}")
    for path in FILES:
        if not path.exists():
            print("missing", path)
            continue
        print(remap_file(path, id_map, unique_ng))


if __name__ == "__main__":
    main()
