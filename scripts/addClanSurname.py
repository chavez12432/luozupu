# -*- coding: utf-8 -*-
"""为族人姓名统一加「罗」姓（不产生「罗罗」），并写回人员相关 JSON。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database"
PKG = ROOT / "pkg-local" / "database"


def strip_clan_surname(name: str) -> str:
    n = str(name or "").strip()
    while n.startswith("罗") and len(n) > 1:
        n = n[1:].strip()
    return n


def with_clan_surname(name: str) -> str:
    raw = str(name or "").strip()
    if not raw:
        return ""
    base = strip_clan_surname(raw)
    if not base:
        return "罗"
    return f"罗{base}"


def looks_like_wife_name(name: str) -> bool:
    """外姓妻常见形态：王氏 / 朱氏香英 / 某某氏"""
    n = str(name or "").strip()
    if not n:
        return True
    if "氏" in n:
        return True
    # 已是他姓双字名且非罗开头的复杂情况：有「氏」才当外姓
    return False


def patch_member(m: dict) -> None:
    m["name"] = with_clan_surname(m.get("name"))
    if m.get("fatherName"):
        m["fatherName"] = with_clan_surname(m["fatherName"])
    # 母亲多为外姓妻，不加罗；若明显是族人名（无「氏」且库内会出现）仍保守：仅无「氏」时加
    mn = str(m.get("motherName") or "").strip()
    if mn and not looks_like_wife_name(mn):
        m["motherName"] = with_clan_surname(mn)

    infos = m.get("spouseInfo") or []
    for s in infos:
        if not isinstance(s, dict):
            continue
        if s.get("isSameVillage") or s.get("linkedMemberId"):
            if s.get("name"):
                s["name"] = with_clan_surname(s["name"])
        # 外姓妻保持原样
    # spouseName：本村配偶才加姓；外姓含「氏」不加
    sn = str(m.get("spouseName") or "").strip()
    if sn:
        has_clan_spouse = any(
            isinstance(s, dict) and (s.get("isSameVillage") or s.get("linkedMemberId"))
            for s in infos
        )
        if has_clan_spouse and not looks_like_wife_name(sn):
            m["spouseName"] = with_clan_surname(sn)
        elif not looks_like_wife_name(sn) and not any(
            isinstance(s, dict) and s.get("name") == sn for s in infos
        ):
            # 无 spouse且不像妻姓：可能是族人简称，仍加罗
            # 但多数 spouseName 是王氏——已由 looks_like_wife_name 拦住
            pass

    # 女婿姓名列表中的本村男
    names = m.get("sonInLawNames") or []
    if isinstance(names, list) and names:
        # 无法逐条判断是否本村，保持原样（外姓为主）；本村记录在 sons_in_law 表处理
        pass


def patch_wife(w: dict) -> None:
    if w.get("husbandName"):
        w["husbandName"] = with_clan_surname(w["husbandName"])
    # 本村女作为妻子记录时，姓名是族人
    if w.get("isSameVillage") or w.get("linkedMemberId"):
        if w.get("name"):
            w["name"] = with_clan_surname(w["name"])


def patch_sil(s: dict) -> None:
    if s.get("wifeName"):
        s["wifeName"] = with_clan_surname(s["wifeName"])
    if s.get("isSameVillage") or s.get("linkedMemberId"):
        if s.get("name"):
            s["name"] = with_clan_surname(s["name"])


def load_json(path: Path):
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        return None
    if text.lstrip().startswith("["):
        return json.loads(text), "array"
    # jsonl
    rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    return rows, "jsonl"


def save_json(path: Path, data, kind: str):
    if kind == "array":
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        with path.open("w", encoding="utf-8") as f:
            for row in data:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")


def process_members(path: Path):
    data, kind = load_json(path)
    for m in data:
        patch_member(m)
    save_json(path, data, kind)
    print(f"members {path.name}: {len(data)}")


def process_wives(path: Path):
    data, kind = load_json(path)
    for w in data:
        patch_wife(w)
    save_json(path, data, kind)
    print(f"wives {path.name}: {len(data)}")


def process_sil(path: Path):
    data, kind = load_json(path)
    for s in data:
        patch_sil(s)
    save_json(path, data, kind)
    print(f"sons_in_law {path.name}: {len(data)}")


def patch_zanyingyin(path: Path):
    text = path.read_text(encoding="utf-8")

    def repl_name(m):
        name = m.group(1)
        return f"name: '{with_clan_surname(name)}'"

    # 仅替换条目里的 name: 'xxx'
    new_text, n = re.subn(r"name:\s*'([^']*)'", repl_name, text)
    path.write_text(new_text, encoding="utf-8")
    print(f"zanyingyin {path.name}: replaced {n} name fields")


def main():
    member_files = [
        "members_export.json",
        "members_ancient_export.json",
        "members_modern_export.json",
        "members_cloud_import.json",
    ]
    wife_files = ["wives_export.json", "wives_cloud_import.json"]
    sil_files = ["sons_in_law_export.json", "sons_in_law_cloud_import.json"]

    for folder in (DB, PKG):
        if not folder.exists():
            continue
        print("==", folder)
        for name in member_files:
            p = folder / name
            if p.exists():
                process_members(p)
        for name in wife_files:
            p = folder / name
            if p.exists():
                process_wives(p)
        for name in sil_files:
            p = folder / name
            if p.exists():
                process_sil(p)

    for zyy in (
        ROOT / "utils" / "zanyingyinHonor.js",
        ROOT / "cloudfunctions" / "adminApi" / "zanyingyinHonor.js",
    ):
        if zyy.exists():
            patch_zanyingyin(zyy)

    # 抽查
    sample = json.loads((DB / "members_export.json").read_text(encoding="utf-8"))
    for mid in ("M0001", "M0393", "M0561"):
        m = next(x for x in sample if x["memberId"] == mid)
        print("sample", mid, m["name"], "father", m.get("fatherName"), "spouse", m.get("spouseName"))


if __name__ == "__main__":
    main()
