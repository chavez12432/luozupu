# -*- coding: utf-8 -*-
"""把八景诗改成 scenes（图配诗），并同步种子文件。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "database" / "fengtu_seed.json"
CLOUD = ROOT / "cloudfunctions" / "adminApi" / "fengtu_seed.json"
LOCAL_JS = ROOT / "utils" / "fengtuSeed.js"

SCENES_META = [
    ("一、凤山耸翠", "/images/bajing/01.jpg"),
    ("二、泸水拖蓝", "/images/bajing/02.jpg"),
    ("三、官厅夜月", "/images/bajing/03.jpg"),
    ("四、祠宇朝烟", "/images/bajing/04.jpg"),
    ("五、石梁横渡", "/images/bajing/05.jpg"),
    ("六、古柏参天", "/images/bajing/06.jpg"),
    ("七、下里桥梁", "/images/bajing/07.jpg"),
    ("八、板背坡溪", "/images/bajing/08.jpg"),
]

POEMS = {
    "一、凤山耸翠": """凤山高耸入云端，翠色连绵望眼宽。
雨后岚光浮远岫，风前树影拂层峦。
千章古木藏幽鸟，万壑清泉泻碧滩。
胜境天然图画里，四时佳致共盘桓。""",
    "二、泸水拖蓝": """泸水拖蓝绕郭流，澄清彻底见沙鸥。
波涵倒影天光乱，浪拍长堤月色浮。
灌溉田畴资利赖，通行舟楫便往游。
源头活水深无限，泽被苍生万古秋。""",
    "三、官厅夜月": """官厅旧址尚依然，夜月清辉照槛前。
桂影婆娑移画栋，蟾光潋滟满阶砖。
寒蛩切切鸣墙脚，宿鸟栖栖集树巅。
想见昔人曾此聚，吟诗把酒乐无边。""",
    "四、祠宇朝烟": """祠宇巍峨气象雄，朝烟袅袅散晴空。
香焚宝鼎通三界，烛映华堂达九重。
子孙济济趋庭下，俎豆莘莘列案中。
报本追远情无限，千秋万代仰高风。""",
    "五、石梁横渡": """石梁横渡跨溪头，坚固何须用舟楫。
行人往来无阻隔，车马经过任自由。
苔痕斑驳留古迹，水声潺湲送清流。
功成不必皆由己，利济苍生即壮游。""",
    "六、古柏参天": """古柏参天势独尊，苍皮溜雨老龙鳞。
风霜历尽柯犹劲，岁月迁回叶更春。
庇荫一方资静憩，扶持千古见精神。
栋梁之器非虚语，留与后人作样看。""",
    "七、下里桥梁": """下里从来称要途，长桥迤屹卧江湖。
插天绛蝀形相若，跨海鲸鲵势不殊。
行道喜无徒涉苦，望洋久免载胥辜。
粤稽圯上虽难再，题志相如永步趋。""",
    "八、板背坡溪": """长流坡水穿田中，灌溉不劳岁屡丰。
盈涸无闻登邑誌，高低咸润佐农功。
户饶岂僅厚生计，大有还为正德风。
自古帝王崇穑事，欣瞻黍稷歌芃芃。""",
}


def main():
    data = json.loads(SEED.read_text(encoding="utf-8"))
    scenes = []
    for title, image in SCENES_META:
        scenes.append({
            "title": title,
            "poem": POEMS[title],
            "image": image,
        })

    for item in data:
        if item.get("seedId") == "ft-bajing" or item.get("title") == "高洲罗氏八景诗":
            item["layout"] = "poem"
            item["scenes"] = scenes
            item["images"] = [s["image"] for s in scenes]
            item["content"] = "（清·嘉庆十六年续修族谱）左右滑动，一页一景。"
            item["summary"] = "高洲罗氏八景诗，图配诗，一页一景。"
            break
    else:
        raise SystemExit("bajing item not found")

    text = json.dumps(data, ensure_ascii=False, indent=2)
    SEED.write_text(text, encoding="utf-8", newline="\n")
    CLOUD.write_text(text, encoding="utf-8", newline="\n")

    for item in data:
        if not item.get("_id"):
            item["_id"] = item.get("seedId") or item.get("title")
    LOCAL_JS.write_text(
        "// 风土志本地兜底种子\nconst list = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n\nmodule.exports = { list };\n",
        encoding="utf-8",
        newline="\n",
    )
    print("updated scenes", len(scenes))


if __name__ == "__main__":
    main()
