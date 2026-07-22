# -*- coding: utf-8 -*-
"""从 D:\\家谱\\九篇寿序2.md 生成颂寿静态 data.js 与风土志种子 JSON。"""
from __future__ import annotations

import json
import re
from pathlib import Path

SRC = Path(r"D:\家谱\九篇寿序2.md")
ROOT = Path(__file__).resolve().parents[1]
OUT_SS = ROOT / "pages" / "songshou" / "data.js"
OUT_FT = ROOT / "database" / "fengtu_seed.json"


def split_articles(text: str) -> list[tuple[str, str]]:
    """Return [(title, body), ...] for ## 第N篇 ... sections and 八景诗."""
    parts = []
    # Main articles
    pattern = re.compile(r"^##\s+(第[一二三四五六七八九]篇[：:].+?)\s*$", re.M)
    matches = list(pattern.finditer(text))
    for i, m in enumerate(matches):
        title = m.group(1)
        # Clean title: 第一篇：《xxx》 -> xxx
        t = re.sub(r"^第[一二三四五六七八九]篇[：:]\s*", "", title)
        t = t.strip("《》")
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else None
        body = text[start:end] if end else text[start:]
        # Cut before 八景诗 helper text if present in last article
        if "高洲罗氏八景诗" in body and i == len(matches) - 1:
            # keep 祠堂简言 only until the AI helper paragraph
            cut = body.find("根据您提供的图片信息")
            if cut > 0:
                body = body[:cut]
        parts.append((t, body.strip()))

    # 八景诗 as separate
    poem_m = re.search(r"###\s*高洲罗氏八景诗\s*\n([\s\S]+)$", text)
    if poem_m:
        poem_body = poem_m.group(0)
        # strip trailing junk
        parts.append(("高洲罗氏八景诗", poem_body.strip()))
    return parts


def section(body: str, *headers: str) -> str:
    for h in headers:
        m = re.search(
            rf"###\s*{re.escape(h)}\s*\n([\s\S]*?)(?=\n###\s|\n---\s*$|\Z)",
            body,
        )
        if m:
            return m.group(1).strip()
    return ""


def notes_from(body: str) -> str:
    people = section(body, "三、对应人物")
    comment = section(body, "四、文章点评")
    chunks = []
    if people:
        chunks.append("【对应人物】\n\n" + people)
    if comment:
        chunks.append("【文章点评】\n\n" + comment)
    return "\n\n".join(chunks).strip()


def meta_from_title(title: str, body: str, idx: int) -> dict:
    # Try year from original ending
    year = ""
    dynasty = ""
    author = ""
    gen = ""
    # from 对应人物 table first row
    people = section(body, "三、对应人物")
    rows = re.findall(r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", people)
    # skip header
    data_rows = [r for r in rows if "文中称谓" not in r[0] and "---" not in r[0]]
    if data_rows:
        # first is usually subject, last author often
        for r in data_rows:
            if "撰" in r[0] or "撰文" in r[0] or "外部" in r[1]:
                author = r[1].split("（")[0].strip()
                break
        if not author and len(data_rows) > 1:
            author = data_rows[-1][1].split("（")[0].strip()
        # subject generation from first data row
        gen = data_rows[0][2].strip() if data_rows else ""

    # year from original last lines
    orig = section(body, "一、原文（校订版）") or body
    ym = re.search(
        r"(乾隆|嘉庆|雍正|道光|光绪|宣统|明|宋|元|清|公元)?[^\n]{0,20}?(\d{3,4})\s*年",
        orig[-400:] if len(orig) > 400 else orig,
    )
    if ym:
        year = ym.group(2) + "年"
        if ym.group(1):
            dynasty = ym.group(1)
    if "2006" in body or "2008" in body and idx == 5:
        year = "2006年"
        dynasty = "近现代"
    return {
        "authorName": author or "",
        "authorGeneration": gen or "",
        "dynasty": dynasty or "",
        "year": year or "",
    }


def parse_classic(title: str, body: str, idx: int) -> dict:
    original = section(body, "一、原文（校订版）")
    translation = section(body, "二、现代文翻译")
    notes = notes_from(body)
    meta = meta_from_title(title, body, idx)
    # Article 6 modern only
    if not original and not translation:
        # strip markdown headers
        text = re.sub(r"^###\s+.*$", "", body, flags=re.M).strip()
        # remove trailing ---
        text = re.sub(r"\n---\s*$", "", text).strip()
        original = text
        translation = ""
        notes = notes_from(body)
        meta = {
            "authorName": "罗庆良等",
            "authorGeneration": "第三十五代",
            "dynasty": "近现代",
            "year": "2006年",
        }
    summary = (translation or original or "")[:80].replace("\n", "") + "…"
    return {
        "id": idx + 1,
        "title": title,
        "summary": summary,
        **meta,
        "date": meta.get("year") or "",
        "original": original,
        "translation": translation,
        "notes": notes,
    }


def parse_plain(title: str, body: str) -> str:
    # remove ### headers if any, keep content
    text = body
    text = re.sub(r"^###\s+.*$", "", text, flags=re.M)
    text = re.sub(r"\n---\s*$", "", text).strip()
    return text


def main():
    text = SRC.read_text(encoding="utf-8")
    articles = split_articles(text)
    print("articles:", [a[0] for a in articles])

    # Map expected titles
    songshou = []
    fengtu = []
    for title, body in articles:
        if any(
            k in title
            for k in ("寿序", "寿屏", "贺父亲")
        ) or title.startswith("罗公") or "寿" in title and "堂记" not in title and "八景" not in title and "祠堂" not in title:
            if len(songshou) < 6:
                songshou.append(parse_classic(title, body, len(songshou)))
                continue
        if "中和堂记" in title:
            d = parse_classic("高洲中和堂记", body, 0)
            fengtu.append(
                {
                    "seedId": "ft-zhonghe",
                    "layout": "classic",
                    "title": "高洲中和堂记",
                    "authorName": d["authorName"],
                    "authorGeneration": d["authorGeneration"],
                    "dynasty": d["dynasty"] or "清",
                    "year": d["year"] or "1724年",
                    "summary": d["summary"],
                    "original": d["original"],
                    "translation": d["translation"],
                    "notes": d["notes"],
                    "content": "",
                    "images": [],
                    "sortOrder": 1,
                    "published": True,
                }
            )
        elif "德裕堂记" in title:
            d = parse_classic("高洲德裕堂记", body, 0)
            fengtu.append(
                {
                    "seedId": "ft-deyu",
                    "layout": "classic",
                    "title": "高洲德裕堂记",
                    "authorName": d["authorName"],
                    "authorGeneration": d["authorGeneration"],
                    "dynasty": d["dynasty"] or "清",
                    "year": d["year"] or "1760年",
                    "summary": d["summary"],
                    "original": d["original"],
                    "translation": d["translation"],
                    "notes": d["notes"],
                    "content": "",
                    "images": [],
                    "sortOrder": 2,
                    "published": True,
                }
            )
        elif "祠堂简言" in title:
            content = parse_plain(title, body)
            fengtu.append(
                {
                    "seedId": "ft-cian",
                    "layout": "plain",
                    "title": "祠堂简言 续告后人",
                    "authorName": "罗冬香",
                    "authorGeneration": "第三十四代",
                    "dynasty": "近现代",
                    "year": "2008年",
                    "summary": "记述高洲罗氏各祠堂沿革与近况，告示后人。",
                    "original": "",
                    "translation": "",
                    "notes": "",
                    "content": content,
                    "images": [],
                    "sortOrder": 3,
                    "published": True,
                }
            )
        elif "八景诗" in title:
            # extract poem section content
            content = body
            content = re.sub(r"^###\s*高洲罗氏八景诗\s*\n?", "", content)
            content = content.strip()
            fengtu.append(
                {
                    "seedId": "ft-bajing",
                    "layout": "poem",
                    "title": "高洲罗氏八景诗",
                    "authorName": "",
                    "authorGeneration": "",
                    "dynasty": "清",
                    "year": "1811年",
                    "summary": "高洲罗氏八景诗（诗配图，图片待补）。",
                    "original": "",
                    "translation": "",
                    "notes": "",
                    "content": content,
                    "images": [],
                    "sortOrder": 4,
                    "published": True,
                }
            )

    # Ensure songshou first 6 by article order in file
    if len(songshou) < 6:
        # fallback: take first 6 ## 第N篇
        songshou = []
        for title, body in articles[:6]:
            songshou.append(parse_classic(title, body, len(songshou)))

    print(f"songshou={len(songshou)} fengtu={len(fengtu)}")
    for s in songshou:
        print(" SS", s["id"], s["title"], "orig", len(s["original"]), "tr", len(s["translation"]))
    for f in fengtu:
        print(" FT", f["sortOrder"], f["layout"], f["title"])

    # Write songshou data.js
    OUT_SS.parent.mkdir(parents=True, exist_ok=True)
    list_items = [
        {
            "id": s["id"],
            "title": s["title"],
            "authorName": s["authorName"],
            "authorGeneration": s["authorGeneration"],
            "dynasty": s["dynasty"],
            "year": s["year"],
            "summary": s["summary"],
        }
        for s in songshou
    ]
    contents = {
        str(s["id"]): {
            "title": s["title"],
            "authorName": s["authorName"],
            "authorGeneration": s["authorGeneration"],
            "dynasty": s["dynasty"],
            "year": s["year"],
            "date": s["date"],
            "original": s["original"],
            "translation": s["translation"],
            "notes": s["notes"],
        }
        for s in songshou
    }

    def js_str(obj):
        return json.dumps(obj, ensure_ascii=False, indent=2)

    OUT_SS.write_text(
        "// 颂寿篇静态数据（由 scripts/importSongshouFengtu.py 生成）\n"
        f"const list = {js_str(list_items)};\n\n"
        f"const contents = {js_str(contents)};\n\n"
        "module.exports = { list, contents };\n",
        encoding="utf-8",
        newline="\n",
    )
    print("wrote", OUT_SS)

    # Order fengtu: 中和、德裕、简言、八景
    order = {"ft-zhonghe": 1, "ft-deyu": 2, "ft-cian": 3, "ft-bajing": 4}
    fengtu.sort(key=lambda x: order.get(x["seedId"], 99))
    for i, f in enumerate(fengtu):
        f["sortOrder"] = i + 1

    OUT_FT.write_text(json.dumps(fengtu, ensure_ascii=False, indent=2), encoding="utf-8", newline="\n")
    print("wrote", OUT_FT)


if __name__ == "__main__":
    main()
