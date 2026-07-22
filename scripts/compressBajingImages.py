# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image

SRC = Path(r"D:/家谱/八景")
DST = Path(r"d:/家谱/luozupu/project/images/bajing")
DST.mkdir(parents=True, exist_ok=True)

ORDER = [
    "一、凤山耸翠.png",
    "二、泸水拖蓝.png",
    "三、官厅夜月.png",
    "四、祠宇朝烟.png",
    "五、石梁横渡.png",
    "六、古柏参天.png",
    "七、下里桥梁.png",
    "八、板背坡溪.png",
]

for i, name in enumerate(ORDER, 1):
    p = SRC / name
    if not p.exists():
        print("MISSING", name)
        continue
    im = Image.open(p).convert("RGB")
    w, h = im.size
    max_w = 720
    if w > max_w:
        nh = int(h * max_w / w)
        im = im.resize((max_w, nh), Image.Resampling.LANCZOS)
    out = DST / f"{i:02d}.jpg"
    im.save(out, "JPEG", quality=52, optimize=True)
    print(i, name, out.name, out.stat().st_size)

print("total", sum(f.stat().st_size for f in DST.glob("*.jpg")))
