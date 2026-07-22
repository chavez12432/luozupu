# -*- coding: utf-8 -*-
"""从簪缨引源文件中删除成员库查无的条目，并同步 utils / adminApi 两份。"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATHS = [
    ROOT / "utils" / "zanyingyinHonor.js",
    ROOT / "cloudfunctions" / "adminApi" / "zanyingyinHonor.js",
]

# 乡贤：库中无此人（含仅同名异世如明代「罗俊」）
REMOVE_SAGE_IDS = {
    "zyy-shiju",
    "zyy-shibeng",
    "zyy-jingfu",
    "zyy-renfu",
    "zyy-jin",
    "zyy-xun",
    "zyy-maojv",
    "zyy-zhongxian",
    "zyy-wuren",
    "zyy-jianshan",
    "zyy-jun",
    "zyy-ren17",
    "zyy-guang",
    "zyy-xin",
    "zyy-dazhong",
    "zyy-dahong",
    "zyy-zhi",
}

# 学历补充：同上
REMOVE_EDU_NAMES = {
    "罗敬夫",
    "罗懋举",
    "罗兼善",
    "罗俊",
    "罗仁",
}


def remove_sage_blocks(js: str) -> tuple[str, int]:
    removed = 0
    for sid in sorted(REMOVE_SAGE_IDS):
        # 匹配整段对象（含前导空白与后随逗号）
        pat = re.compile(
            rf"\n\s*\{{\s*id:\s*'{re.escape(sid)}'[\s\S]*?\n\s*\}},?",
            re.M,
        )
        new_js, n = pat.subn("\n", js, count=1)
        if n:
            js = new_js
            removed += n
        else:
            print(f"  WARN sage not found: {sid}")
    return js, removed


def remove_edu_blocks(js: str) -> tuple[str, int]:
    removed = 0
    # 定位 ZANYINGYIN_EDUCATION 数组
    m = re.search(r"const ZANYINGYIN_EDUCATION\s*=\s*\[", js)
    if not m:
        print("  WARN education array not found")
        return js, 0
    start = m.end() - 1
    depth = 0
    end = None
    for i in range(start, len(js)):
        if js[i] == "[":
            depth += 1
        elif js[i] == "]":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        return js, 0
    head, block, tail = js[:start], js[start:end], js[end:]
    for name in sorted(REMOVE_EDU_NAMES):
        pat = re.compile(
            rf"\n\s*\{{\s*name:\s*'{re.escape(name)}'[\s\S]*?\n\s*\}},?",
            re.M,
        )
        new_block, n = pat.subn("\n", block, count=1)
        if n:
            block = new_block
            removed += n
        else:
            print(f"  WARN edu not found: {name}")
    # 清理多余空行
    block = re.sub(r"\n{3,}", "\n\n", block)
    return head + block + tail, removed


def tidy(js: str) -> str:
    js = re.sub(r",\s*\n(\s*)\]", r"\n\1]", js)
    js = re.sub(r"\n{3,}", "\n\n", js)
    return js


def main():
    for path in PATHS:
        print(f"patch {path.relative_to(ROOT)}")
        text = path.read_text(encoding="utf-8")
        text, n1 = remove_sage_blocks(text)
        text, n2 = remove_edu_blocks(text)
        text = tidy(text)
        path.write_text(text, encoding="utf-8", newline="\n")
        print(f"  removed sages={n1} edu={n2}")


if __name__ == "__main__":
    main()
