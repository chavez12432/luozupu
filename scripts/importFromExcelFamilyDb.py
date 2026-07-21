# -*- coding: utf-8 -*-
"""
从 D:\\家谱\\database 四张 Excel 重建人员库 JSON。

写出：
  database/members_export.json
  database/members_ancient_export.json
  database/members_modern_export.json
  database/wives_export.json
  database/sons_in_law_export.json
  以及对应 *_cloud_import.json（JSONL）
  可选同步到 pkg-local/database/

Usage:
  python scripts/importFromExcelFamilyDb.py
  python scripts/importFromExcelFamilyDb.py --sync-pkg-local
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

def split_multi_cell(val):
    """Excel 一格多值：本科，硕士 / A大学,B大学"""
    if val is None or val == "":
        return []
    return [p.strip() for p in re.split(r"[,，、;；/|]", str(val)) if p and str(p).strip()]


def build_education_entries(edu, school, graduate_year, raw_year=None):
    education = []
    if not (edu or school or graduate_year or raw_year):
        return education
    degrees = split_multi_cell(edu)
    schools = split_multi_cell(school)
    years = []
    if isinstance(raw_year, str) and any(ch in raw_year for ch in ",，、;；"):
        for p in split_multi_cell(raw_year):
            try:
                years.append(int(str(p).replace("年", "").strip()))
            except ValueError:
                pass
    elif graduate_year is not None:
        years = [graduate_year]
    n = max(len(degrees), len(schools), len(years), 1)
    for i in range(n):
        d = degrees[i] if i < len(degrees) else (degrees[0] if len(degrees) == 1 else "")
        s = schools[i] if i < len(schools) else (schools[0] if len(schools) == 1 else "")
        y = years[i] if i < len(years) else (years[0] if len(years) == 1 else None)
        if not d and not s and y is None:
            continue
        education.append({"degree": d or "", "school": s or "", "year": y, "isDefault": i == 0})
    if not education:
        education.append({
            "degree": edu or "",
            "school": school or "",
            "year": graduate_year,
            "isDefault": True,
        })
    return education


def build_position_entries(workplace, position):
    if not (workplace or position):
        return []
    orgs = split_multi_cell(workplace)
    titles = split_multi_cell(position)
    n = max(len(orgs), len(titles), 1)
    out = []
    for i in range(n):
        if not orgs and titles:
            org, tit = "", titles[i] if i < len(titles) else ""
        elif not titles and orgs:
            org, tit = orgs[i] if i < len(orgs) else "", ""
        else:
            org = orgs[i] if i < len(orgs) else (orgs[0] if len(orgs) == 1 else "")
            tit = titles[i] if i < len(titles) else (titles[0] if len(titles) == 1 and len(orgs) <= 1 else "")
        if not org and not tit:
            continue
        out.append({
            "title": tit or "",
            "organization": org or "",
            "isDefault": i == 0,
            "isCurrent": True,
        })
    if not out:
        out.append({
            "title": position or "",
            "organization": workplace or "",
            "isDefault": True,
            "isCurrent": True,
        })
    return out
ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database"
PKG = ROOT / "pkg-local" / "database"
REPORT = DB / "import_from_excel_report.json"

ANCIENT_XLSX = SRC / "【古】罗氏家谱.xlsx"
MODERN_XLSX = SRC / "【今】罗氏家谱.xlsx"
WIVES_XLSX = SRC / "妻子表.xlsx"
SIL_XLSX = SRC / "女婿表.xlsx"

ISO_NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def clean_text(v):
    if v is None:
        return ""
    s = str(v).replace("_x000D_", "").replace("\r", "").replace("\n", " ").strip()
    return s


def strip_clan_surname(name):
    n = clean_text(name)
    while n.startswith("罗") and len(n) > 1:
        n = n[1:].strip()
    return n


def with_clan_surname(name):
    raw = clean_text(name)
    if not raw:
        return ""
    base = strip_clan_surname(raw)
    return f"罗{base}" if base else "罗"


def looks_like_wife_name(name):
    n = clean_text(name)
    return (not n) or ("氏" in n)


def split_ids(v):
    s = clean_text(v)
    if not s or s == "None":
        return []
    return [p for p in re.split(r"[,，;；、\s|/｜]+", s) if p]


def to_int(v, default=None):
    if v is None or v == "":
        return default
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def is_external_spouse_id(sid: str) -> bool:
    return bool(re.search(r"[WS]\d+$", sid or ""))


def is_clan_member_id(sid: str, member_ids: set) -> bool:
    return bool(sid) and sid in member_ids and not is_external_spouse_id(sid)


def load_sheet(path: Path, sheet=None):
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet] if sheet else wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    hdr = None
    hidx = 0
    for i, r in enumerate(rows[:5]):
        if not r:
            continue
        vals = [clean_text(c) if c is not None else "" for c in r]
        if "ID" in vals:
            hdr = vals
            hidx = i
            break
    if not hdr:
        raise RuntimeError(f"未找到表头: {path}")
    data = []
    for r in rows[hidx + 1 :]:
        if not r or all(c is None or clean_text(c) == "" for c in r):
            continue
        d = {}
        for j, h in enumerate(hdr):
            if not h:
                continue
            v = r[j] if j < len(r) else None
            if isinstance(v, str):
                v = clean_text(v)
            d[h] = v
        data.append(d)
    return data


def parse_ymd_dotted(text: str):
    s = clean_text(text)
    if not s:
        return None
    m = re.match(r"^(\d{3,4})(?:\.(\d{1,2}))?(?:\.(\d{1,2}))?", s)
    if not m:
        return None
    return {
        "year": int(m.group(1)),
        "month": int(m.group(2)) if m.group(2) else None,
        "day": int(m.group(3)) if m.group(3) else None,
        "isLeap": "闰" in s,
    }


def empty_date():
    return {
        "lunar": {"year": None, "month": None, "day": None, "isLeap": False},
        "gregorian": {"year": None, "month": None, "day": None},
        "dynasty": "",
        "eraName": "",
        "eraYear": None,
        "ganzhi": "",
        "zodiac": "",
        "raw": "",
        "converted": False,
    }


def build_ancient_date(raw_date, dynasty, ganzhi, zodiac=""):
    d = empty_date()
    raw = clean_text(raw_date)
    d["raw"] = raw
    d["dynasty"] = clean_text(dynasty)
    d["ganzhi"] = clean_text(ganzhi)
    d["zodiac"] = clean_text(zodiac)
    lunar = parse_ymd_dotted(raw)
    if lunar:
        d["lunar"]["year"] = lunar.get("year")
        d["lunar"]["month"] = lunar.get("month")
        d["lunar"]["day"] = lunar.get("day")
        d["lunar"]["isLeap"] = lunar.get("isLeap", False)
        if lunar.get("year"):
            d["lunar"]["formatted"] = raw
            d["converted"] = True
    elif raw or d["dynasty"] or d["ganzhi"]:
        d["converted"] = bool(d["dynasty"] or d["ganzhi"] or raw)
    return d


def build_modern_date(lunar_text, ganzhi, gregorian_text, zodiac_or_sign="", is_birth=True):
    d = empty_date()
    d["raw"] = clean_text(lunar_text) or clean_text(gregorian_text)
    d["ganzhi"] = clean_text(ganzhi)
    lunar = parse_ymd_dotted(lunar_text)
    if lunar:
        d["lunar"]["year"] = lunar.get("year")
        d["lunar"]["month"] = lunar.get("month")
        d["lunar"]["day"] = lunar.get("day")
        d["lunar"]["isLeap"] = lunar.get("isLeap", False)
        if lunar.get("year"):
            d["lunar"]["formatted"] = clean_text(lunar_text)
            d["converted"] = True
    graw = clean_text(gregorian_text)
    gm = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", graw)
    if gm:
        d["gregorian"] = {
            "year": int(gm.group(1)),
            "month": int(gm.group(2)),
            "day": int(gm.group(3)),
            "formatted": graw,
        }
        d["converted"] = True
    sign = clean_text(zodiac_or_sign)
    if is_birth:
        if sign and "座" in sign:
            d["constellation"] = sign
        elif sign:
            d["zodiac"] = sign
    elif sign:
        d["zodiac"] = sign
    if d["ganzhi"] and not d.get("zodiac"):
        for z in "鼠牛虎兔龙蛇马羊猴鸡狗猪":
            if z in d["ganzhi"]:
                d["zodiac"] = z
                break
    return d


def maiden_from_name(name: str) -> str:
    n = clean_text(name)
    if not n:
        return ""
    if n.endswith("氏") and len(n) >= 2:
        return n[0]
    if len(n) >= 2 and n[0] not in "（(":
        return n[0]
    return ""


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_jsonl(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in data:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def convert_member(row: dict, era: str, member_ids: set, wives_by_id: dict) -> dict:
    mid = clean_text(row.get("ID"))
    gender = clean_text(row.get("性别")) or "未知"
    spouse_ids = split_ids(row.get("配偶ID"))
    sil_ids = split_ids(row.get("女婿ID"))

    spouse_info = []
    for sid in spouse_ids:
        w = wives_by_id.get(sid)
        is_sv = False
        linked = ""
        name = ""
        mtype = "配"
        hometown = ""
        if w:
            name = clean_text(w.get("姓名"))
            mtype = clean_text(w.get("婚配类型")) or "配"
            hometown = clean_text(w.get("家乡"))
            is_sv = clean_text(w.get("是否本村人")) == "是"
            linked = clean_text(w.get("本村族人ID")) or (
                sid if is_clan_member_id(sid, member_ids) else ""
            )
            if is_sv or linked:
                name = with_clan_surname(name)
        elif is_clan_member_id(sid, member_ids):
            is_sv = True
            linked = sid
            name = with_clan_surname(name) if name else ""
        spouse_info.append(
            {
                "name": name,
                "type": mtype,
                "hometown": hometown,
                "wifeId": sid,
                "isSameVillage": is_sv or is_clan_member_id(sid, member_ids),
                "linkedMemberId": linked
                if (is_sv or is_clan_member_id(sid, member_ids))
                else "",
            }
        )

    if era == "ancient":
        birth = build_ancient_date(
            row.get("出生日期"), row.get("出生朝代"), row.get("出生干支"), row.get("生肖")
        )
        death = build_ancient_date(
            row.get("逝世日期"), row.get("逝世朝代"), row.get("逝世干支"), ""
        )
        honors_raw = clean_text(row.get("荣誉"))
        gongming = clean_text(row.get("功名"))
        guanzhi = clean_text(row.get("官职"))
        remark = clean_text(row.get("个人详情"))
        phone = wechat = school = workplace = position = avatar = gallery = ""
        education = []
        graduate_year = None
        constellation = ""
    else:
        birth = build_modern_date(
            row.get("出生农历"),
            row.get("出生干支"),
            row.get("出生公历"),
            row.get("星座"),
            True,
        )
        death = build_modern_date(
            row.get("逝世农历"), row.get("逝世干支"), row.get("逝世公历"), "", False
        )
        constellation = birth.get("constellation", "")
        honors_raw = clean_text(row.get("荣誉"))
        gongming = ""
        guanzhi = ""
        remark = clean_text(row.get("个人详情"))
        phone = clean_text(row.get("手机号"))
        wechat = clean_text(row.get("微信号"))
        edu = clean_text(row.get("学历"))
        school = clean_text(row.get("学校"))
        graduate_year = to_int(row.get("毕业年份"))
        workplace = clean_text(row.get("工作单位"))
        position = clean_text(row.get("职位"))
        avatar = clean_text(row.get("个人相片"))
        gallery = clean_text(row.get("家族相片展示"))
        education = build_education_entries(edu, school, graduate_year, row.get("毕业年份"))

    positions = []
    if guanzhi:
        positions.append({"title": guanzhi, "isDefault": True, "isCurrent": False})
    positions.extend(build_position_entries(workplace, position))

    honors = []
    for title in filter(None, [honors_raw, gongming]):
        honors.append(
            {"title": title, "type": "荣誉" if title == honors_raw else "功名"}
        )

    primary_spouse = spouse_ids[0] if spouse_ids else ""
    spouse_names = [s["name"] for s in spouse_info if s.get("name")]

    mother_name = clean_text(row.get("母亲姓名"))
    if mother_name and not looks_like_wife_name(mother_name):
        mother_name = with_clan_surname(mother_name)

    spouse_name = (
        spouse_names[0]
        if spouse_names
        else clean_text(row.get("配偶姓名") or row.get("配偶"))
    )

    member = {
        "_id": mid,
        "memberId": mid,
        "originalId": mid,
        "name": with_clan_surname(row.get("姓名")),
        "gender": gender,
        "generation": to_int(row.get("世代"), 0),
        "branch": clean_text(row.get("分堂")),
        "eraCategory": era,
        "fatherId": clean_text(row.get("父亲ID")),
        "fatherName": with_clan_surname(row.get("父亲姓名")),
        "motherId": clean_text(row.get("母亲ID")),
        "motherName": mother_name,
        "residence": clean_text(row.get("居住地")),
        "burialPlace": clean_text(row.get("墓葬地")),
        "lifespan": clean_text(row.get("寿命")),
        "birthDate": birth,
        "deathDate": death,
        "isAlive": not bool(
            clean_text(
                row.get("逝世日期") or row.get("逝世农历") or row.get("逝世公历")
            )
        ),
        "spouseId": primary_spouse,
        "spouseIds": spouse_ids,
        "wifeIds": list(spouse_ids),
        "spouseName": spouse_name,
        "spouseInfo": spouse_info,
        "sonInLawIds": sil_ids,
        "sonInLawNames": split_ids(row.get("女婿姓名")),
        "childrenIds": [],
        "remark": remark,
        "gongming": gongming,
        "guanzhi": guanzhi,
        "honors": honors,
        "positions": positions,
        "education": education,
        "phone": phone,
        "wechat": wechat,
        "avatar": avatar,
        "photoGallery": [gallery] if gallery else [],
        "constellation": constellation,
        "hasBrokenLineage": False,
        "isPublic": False,
        "updatedAt": ISO_NOW,
        "createdAt": ISO_NOW,
    }
    for s in spouse_info:
        if s.get("isSameVillage") and s.get("linkedMemberId"):
            member["clanSpouseId"] = s["linkedMemberId"]
            break
    return member


def convert_wife(row: dict, members_by_id: dict) -> dict:
    wid = clean_text(row.get("ID"))
    hid = clean_text(row.get("丈夫ID"))
    husband = members_by_id.get(hid) or {}
    is_sv = clean_text(row.get("是否本村人")) == "是"
    linked = clean_text(row.get("本村族人ID"))
    if is_sv and not linked:
        linked = wid if wid in members_by_id else ""
    gen = to_int(row.get("世代"))
    if gen is None:
        gen = husband.get("generation")
    if not is_sv and husband.get("generation") is not None:
        gen = husband["generation"]

    name = clean_text(row.get("姓名"))
    if is_sv or linked:
        name = with_clan_surname(name)
    return {
        "_id": wid,
        "wifeId": wid,
        "name": name,
        "maidenName": maiden_from_name(name),
        "hometown": clean_text(row.get("家乡")),
        "generation": gen,
        "husbandId": hid,
        "husbandName": with_clan_surname(
            clean_text(row.get("丈夫姓名")) or husband.get("name", "")
        ),
        "birthText": clean_text(row.get("配偶出生日期")),
        "deathText": clean_text(row.get("配偶逝世日期")),
        "burialPlace": clean_text(row.get("墓葬地")),
        "marriageType": clean_text(row.get("婚配类型")) or "配",
        "marriageOrder": to_int(row.get("婚配序号"), 1),
        "marriageStatus": "married",
        "isSameVillage": is_sv,
        "linkedMemberId": linked if is_sv else "",
        "remark": "",
        "sourceMemberId": hid,
        "createdAt": ISO_NOW,
        "updatedAt": ISO_NOW,
    }


def convert_sil(row: dict, members_by_id: dict) -> dict:
    sid = clean_text(row.get("ID"))
    wife_id = clean_text(row.get("妻子ID"))
    wife = members_by_id.get(wife_id) or {}
    is_sv = clean_text(row.get("是否本村人")) == "是"
    linked = clean_text(row.get("本村族人ID"))
    if is_sv and not linked:
        linked = sid if sid in members_by_id else ""
    gen = to_int(row.get("世代"))
    if gen is None:
        gen = wife.get("generation")
    name = clean_text(row.get("姓名"))
    if is_sv or linked:
        name = with_clan_surname(name)
    return {
        "_id": sid,
        "sonInLawId": sid,
        "name": name,
        "hometown": clean_text(row.get("家乡")),
        "generation": gen,
        "wifeId": wife_id,
        "wifeName": with_clan_surname(
            clean_text(row.get("妻子姓名")) or wife.get("name", "")
        ),
        "marriageOrder": 1,
        "marriageStatus": "married",
        "isSameVillage": is_sv,
        "linkedMemberId": linked if is_sv else "",
        "remark": "",
        "sourceMemberId": wife_id,
        "createdAt": ISO_NOW,
        "updatedAt": ISO_NOW,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sync-pkg-local", action="store_true", help="同步到 pkg-local/database"
    )
    parser.add_argument("--no-backup", action="store_true", help="不备份旧 export")
    args = parser.parse_args()

    ancient_rows = load_sheet(ANCIENT_XLSX)
    modern_rows = load_sheet(MODERN_XLSX)
    wife_rows = load_sheet(WIVES_XLSX, sheet="妻子表")
    sil_rows = load_sheet(SIL_XLSX, sheet="女婿表")

    member_ids = {
        clean_text(r.get("ID")) for r in ancient_rows + modern_rows if r.get("ID")
    }
    wives_by_id = {clean_text(r.get("ID")): r for r in wife_rows if r.get("ID")}

    members = []
    for r in ancient_rows:
        members.append(convert_member(r, "ancient", member_ids, wives_by_id))
    for r in modern_rows:
        members.append(convert_member(r, "modern", member_ids, wives_by_id))

    members_by_id = {m["memberId"]: m for m in members}

    children_map = defaultdict(list)
    for m in members:
        fid = m.get("fatherId") or ""
        if fid:
            children_map[fid].append(m["memberId"])
    for m in members:
        m["childrenIds"] = children_map.get(m["memberId"], [])

    wives = [convert_wife(r, members_by_id) for r in wife_rows]
    sons = [convert_sil(r, members_by_id) for r in sil_rows]

    ancient_out = [m for m in members if m["eraCategory"] == "ancient"]
    modern_out = [m for m in members if m["eraCategory"] == "modern"]

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = DB / f"_backup_personnel_{stamp}"
    if not args.no_backup:
        backup_dir.mkdir(parents=True, exist_ok=True)
        for name in [
            "members_export.json",
            "members_ancient_export.json",
            "members_modern_export.json",
            "wives_export.json",
            "sons_in_law_export.json",
            "members_cloud_import.json",
            "wives_cloud_import.json",
            "sons_in_law_cloud_import.json",
        ]:
            src = DB / name
            if src.exists():
                shutil.copy2(src, backup_dir / name)

    write_json(DB / "members_export.json", members)
    write_json(DB / "members_ancient_export.json", ancient_out)
    write_json(DB / "members_modern_export.json", modern_out)
    write_json(DB / "wives_export.json", wives)
    write_json(DB / "sons_in_law_export.json", sons)

    write_jsonl(DB / "members_cloud_import.json", members)
    write_jsonl(DB / "wives_cloud_import.json", wives)
    write_jsonl(DB / "sons_in_law_cloud_import.json", sons)

    if args.sync_pkg_local:
        PKG.mkdir(parents=True, exist_ok=True)
        for name in [
            "members_ancient_export.json",
            "members_modern_export.json",
            "wives_export.json",
            "sons_in_law_export.json",
        ]:
            shutil.copy2(DB / name, PKG / name)

    report = {
        "time": ISO_NOW,
        "counts": {
            "members": len(members),
            "ancient": len(ancient_out),
            "modern": len(modern_out),
            "wives": len(wives),
            "sons_in_law": len(sons),
            "with_father": sum(1 for m in members if m.get("fatherId")),
            "with_children": sum(1 for m in members if m.get("childrenIds")),
            "same_village_wives": sum(1 for w in wives if w.get("isSameVillage")),
            "same_village_sil": sum(1 for s in sons if s.get("isSameVillage")),
        },
        "backup": str(backup_dir) if not args.no_backup else None,
        "pkg_local_synced": bool(args.sync_pkg_local),
    }
    write_json(REPORT, report)
    print(json.dumps(report["counts"], ensure_ascii=False, indent=2))
    print(f"report: {REPORT}")
    if not args.no_backup:
        print(f"backup: {backup_dir}")
    if args.sync_pkg_local:
        print(f"synced: {PKG}")


if __name__ == "__main__":
    main()
