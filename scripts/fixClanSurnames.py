# -*- coding: utf-8 -*-
"""审计并修复：族人姓名统一冠「罗」，不产生「罗罗」；含荣誉静态数据。"""
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
    n = str(name or "").strip()
    if not n:
        return True
    if "氏" in n:
        return True
    return False


def load_json(path: Path):
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        return None, None
    if text.lstrip().startswith("["):
        return json.loads(text), "array"
    rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    return rows, "jsonl"


def save_json(path: Path, data, kind: str):
    if kind == "array":
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        with path.open("w", encoding="utf-8") as f:
            for row in data:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")


def fix_name_field(obj: dict, key: str, force_clan: bool = True) -> bool:
    """返回是否修改。force_clan=False 时仅对已是族人风格的名字规范罗罗。"""
    if key not in obj:
        return False
    old = obj.get(key)
    if old is None or old == "":
        return False
    s = str(old).strip()
    if not s:
        return False
    if looks_like_wife_name(s) and not force_clan:
        return False
    if looks_like_wife_name(s) and force_clan is False:
        return False
    # 外姓妻绝不加罗
    if looks_like_wife_name(s):
        return False
    new = with_clan_surname(s)
    if new != s:
        obj[key] = new
        return True
    return False


def patch_member(m: dict) -> int:
    n = 0
    if fix_name_field(m, "name", force_clan=True):
        n += 1
    if fix_name_field(m, "fatherName", force_clan=True):
        n += 1
    mn = str(m.get("motherName") or "").strip()
    if mn and not looks_like_wife_name(mn):
        if fix_name_field(m, "motherName", force_clan=True):
            n += 1

    infos = m.get("spouseInfo") or []
    for s in infos:
        if not isinstance(s, dict):
            continue
        if s.get("isSameVillage") or s.get("linkedMemberId"):
            if fix_name_field(s, "name", force_clan=True):
                n += 1

    sn = str(m.get("spouseName") or "").strip()
    if sn:
        has_clan_spouse = any(
            isinstance(s, dict) and (s.get("isSameVillage") or s.get("linkedMemberId"))
            for s in infos
        )
        if has_clan_spouse and not looks_like_wife_name(sn):
            if fix_name_field(m, "spouseName", force_clan=True):
                n += 1
    return n


def patch_wife(w: dict) -> int:
    n = 0
    if fix_name_field(w, "husbandName", force_clan=True):
        n += 1
    if w.get("isSameVillage") or w.get("linkedMemberId"):
        if fix_name_field(w, "name", force_clan=True):
            n += 1
    return n


def patch_sil(s: dict) -> int:
    n = 0
    if fix_name_field(s, "wifeName", force_clan=True):
        n += 1
    if s.get("isSameVillage") or s.get("linkedMemberId"):
        if fix_name_field(s, "name", force_clan=True):
            n += 1
    return n


def audit_members(path: Path):
    data, kind = load_json(path)
    if data is None:
        return
    no_luo = []
    double = []
    for m in data:
        name = str(m.get("name") or "")
        mid = m.get("_id") or m.get("memberId")
        if not name:
            continue
        if name.startswith("罗罗"):
            double.append((mid, name))
        elif not name.startswith("罗"):
            no_luo.append((mid, name, m.get("gender"), m.get("generation")))
    print(f"[AUDIT] {path}: total={len(data)} missing罗={len(no_luo)} 罗罗={len(double)}")
    for x in no_luo[:40]:
        print("   miss", x)
    if len(no_luo) > 40:
        print(f"   ... +{len(no_luo) - 40}")
    for x in double[:20]:
        print("   dbl", x)
    return no_luo, double, data, kind


def process_file(path: Path, kind_hint: str):
    data, kind = load_json(path)
    if data is None:
        return 0
    changed = 0
    for row in data:
        if kind_hint == "members":
            changed += patch_member(row)
        elif kind_hint == "wives":
            changed += patch_wife(row)
        elif kind_hint == "sil":
            changed += patch_sil(row)
    save_json(path, data, kind)
    print(f"[FIX] {path.name}: field_updates={changed} rows={len(data)}")
    return changed


JS_NAME_RE = re.compile(r"(name:\s*['\"])([^'\"]+)(['\"])")


def patch_js_name_fields(path: Path) -> int:
    """替换 JS 对象字面量里的 name: 'xxx' 为冠姓全名（跳过含氏）。"""
    text = path.read_text(encoding="utf-8")
    count = 0

    def repl(m):
        nonlocal count
        prefix, name, suffix = m.group(1), m.group(2), m.group(3)
        if looks_like_wife_name(name):
            return m.group(0)
        # 跳过非人名的 name 字段（极少）；荣誉里 name 都是人名
        new = with_clan_surname(name)
        if new != name:
            count += 1
            return f"{prefix}{new}{suffix}"
        return m.group(0)

    new_text = JS_NAME_RE.sub(repl, text)
    if count:
        path.write_text(new_text, encoding="utf-8")
    print(f"[FIX-JS] {path.relative_to(ROOT)}: name fields updated={count}")
    return count


def audit_js_names(path: Path):
    text = path.read_text(encoding="utf-8")
    miss = []
    dbl = []
    for m in JS_NAME_RE.finditer(text):
        name = m.group(2)
        if looks_like_wife_name(name):
            continue
        if name.startswith("罗罗"):
            dbl.append(name)
        elif not name.startswith("罗"):
            miss.append(name)
    print(f"[AUDIT-JS] {path.relative_to(ROOT)}: miss={len(miss)} dbl={len(dbl)}")
    for n in miss[:30]:
        print("   miss", n)
    for n in dbl[:10]:
        print("   dbl", n)
    return miss, dbl


def main():
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "fix"

    member_files = [
        "members_export.json",
        "members_ancient_export.json",
        "members_modern_export.json",
        "members_cloud_import.json",
        # members.json 为旧样例/非标准 JSON，跳过
    ]
    wife_files = ["wives_export.json", "wives_cloud_import.json"]
    sil_files = ["sons_in_law_export.json", "sons_in_law_cloud_import.json"]

    honor_js = [
        ROOT / "utils" / "zanyingyinHonor.js",
        ROOT / "cloudfunctions" / "adminApi" / "zanyingyinHonor.js",
        ROOT / "utils" / "eliteHeroes.js",
        ROOT / "cloudfunctions" / "adminApi" / "eliteHeroes.js",
    ]

    # 仅处理明确的荣誉姓名文件，避免误改 callFunction name: 'adminApi'
    extra_js = []

    print("======== AUDIT ========")
    for folder in (DB, PKG):
        if not folder.exists():
            continue
        print("==", folder)
        for name in member_files:
            p = folder / name
            if p.exists():
                audit_members(p)

    for p in honor_js + extra_js:
        if p.exists():
            audit_js_names(p)

    if mode == "audit":
        return

    print("======== FIX ========")
    for folder in (DB, PKG):
        if not folder.exists():
            continue
        print("==", folder)
        for name in member_files:
            p = folder / name
            if p.exists():
                process_file(p, "members")
        for name in wife_files:
            p = folder / name
            if p.exists():
                process_file(p, "wives")
        for name in sil_files:
            p = folder / name
            if p.exists():
                process_file(p, "sil")

    seen = set()
    for p in honor_js + extra_js:
        if p.exists() and p.resolve() not in seen:
            seen.add(p.resolve())
            patch_js_name_fields(p)

    print("======== RE-AUDIT ========")
    for folder in (DB, PKG):
        if not folder.exists():
            continue
        for name in member_files:
            p = folder / name
            if p.exists():
                audit_members(p)
    for p in honor_js:
        if p.exists():
            audit_js_names(p)


if __name__ == "__main__":
    main()
