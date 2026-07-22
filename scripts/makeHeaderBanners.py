# -*- coding: utf-8 -*-
"""从八景全图裁出窄幅标题背景：淡化+朱红罩色，体积尽量小。"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "images" / "bajing"
OUT_DIR = ROOT / "images" / "headers"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 750x280 @2x 近似，再压到 750 宽；标题区约占一屏顶部
W, H = 750, 260

# 用途 -> 源图序号、纵向裁切比例(0=顶, 0.5=中)
JOBS = [
    ("preface", 1, 0.28),      # 序文：凤山
    ("songshou", 3, 0.35),     # 颂寿：官厅夜月
    ("fengtu", 2, 0.40),       # 风土：泸水
    ("honor", 6, 0.25),        # 牌坊：古柏
    ("tree", 5, 0.45),         # 谱树：石梁
    ("patriarchs", 4, 0.30),   # 族长：祠宇朝烟
    ("sages", 7, 0.38),        # 簪缨：下里桥梁
    ("elite", 8, 0.42),        # 群英：板背坡溪
    ("graduates", 1, 0.55),    # 学历：凤山下半幅
    ("index", 4, 0.18),        # 大厅：祠宇朝烟偏上
    ("auth", 3, 0.22),         # 验证：官厅夜月偏上
]

CRIMSON = (155, 25, 25)


def crop_banner(im: Image.Image, focus_y: float) -> Image.Image:
    im = ImageOps.exif_transpose(im)
    w, h = im.size
    target_ratio = W / H
    # 先按目标比例取横幅
    crop_h = int(w / target_ratio)
    if crop_h > h:
        crop_h = h
        crop_w = int(h * target_ratio)
        left = (w - crop_w) // 2
        top = 0
        box = (left, top, left + crop_w, top + crop_h)
    else:
        top = int(max(0, min(h - crop_h, (h - crop_h) * focus_y)))
        box = (0, top, w, top + crop_h)
    banner = im.crop(box).resize((W, H), Image.Resampling.LANCZOS)
    return banner.convert("RGB")


def wash(im: Image.Image) -> Image.Image:
    # 降饱和、略提亮中部再压暗，避免抢字
    im = ImageEnhance.Color(im).enhance(0.35)
    im = ImageEnhance.Contrast(im).enhance(0.85)
    im = ImageEnhance.Brightness(im).enhance(0.75)
    overlay = Image.new("RGB", im.size, CRIMSON)
    # 照片只露约 30%，其余朱红底
    return Image.blend(overlay, im, alpha=0.32)


def main():
    total = 0
    for name, idx, focus in JOBS:
        src = SRC_DIR / f"{idx:02d}.jpg"
        if not src.exists():
            print("missing", src)
            continue
        banner = wash(crop_banner(Image.open(src), focus))
        out = OUT_DIR / f"{name}.jpg"
        banner.save(out, "JPEG", quality=58, optimize=True, progressive=True)
        size = out.stat().st_size
        total += size
        print(f"{name}.jpg <- {src.name} focus={focus} {size} bytes")
    print("total", total)


if __name__ == "__main__":
    main()
