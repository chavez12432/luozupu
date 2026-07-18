#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重新排列族谱序的ID顺序
原顺序: 1=七续修(2008), 2=首修(1174), 3=二修(1409), 4=三修(1423), 5=四修(1524), 6=五修(1702), 7=六修(1811), 8=黄周万(1765), 9=庆源传(1066), 10=临清派(1766)
新顺序: 1=首修(1174), 2=二修(1409), 3=三修(1423), 4=四修(1524), 5=五修(1702), 6=六修(1811), 7=七续修(2008), 8=黄周万(1765), 9=庆源传(1066), 10=临清派(1766)
"""

import re

# ID映射关系: 旧ID -> 新ID
id_mapping = {
    2: 1,   # 首修(1174) -> id 1
    3: 2,   # 二修(1409) -> id 2
    4: 3,   # 三修(1423) -> id 3
    5: 4,   # 四修(1524) -> id 4
    6: 5,   # 五修(1702) -> id 5
    7: 6,   # 六修(1811) -> id 6
    1: 7,   # 七续修(2008) -> id 7
    8: 8,   # 黄周万(1765) -> id 8
    9: 9,   # 庆源传(1066) -> id 9
    10: 10  # 临清派(1766) -> id 10
}

# 读取原文件
with open('detail.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 提取每个预face的内容
# 使用正则表达式匹配每个id对应的内容块
pattern = r'(\d+):\s*\{[\s\S]*?\n    \}(?=,|\s*\})'
matches = list(re.finditer(pattern, content))

# 创建新的内容映射
preface_contents = {}
for match in matches:
    old_id = int(match.group(1))
    preface_contents[old_id] = match.group(0)

# 构建新的文件内容
new_prefaces = []
for old_id, new_id in id_mapping.items():
    if old_id in preface_contents:
        old_content = preface_contents[old_id]
        # 替换ID
        new_content = re.sub(r'^\d+:', f'{new_id}:', old_content)
        new_prefaces.append(new_content)

# 按新ID排序
new_prefaces.sort(key=lambda x: int(re.match(r'(\d+):', x).group(1)))

# 构建完整的prefaceContents对象
preface_contents_str = '  prefaceContents: {\n    ' + ',\n    '.join(new_prefaces) + '\n  }'

# 替换原文件中的prefaceContents部分
# 找到prefaceContents的开始和结束位置
start_marker = '  // 八篇族谱序的完整内容\n  prefaceContents: {'
end_marker = '  },\n\n  onLoad'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + '  // 八篇族谱序的完整内容\n' + preface_contents_str + content[end_idx+3:]
    
    # 写入新文件
    with open('detail.js', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("文件已成功更新!")
    print("\n新的ID顺序:")
    print("1: 高洲罗氏首修族谱序 (1174年)")
    print("2: 高洲罗氏二次增修族谱序 (1409年)")
    print("3: 双池府君三次增修族谱序 (1423年)")
    print("4: 高洲罗氏四续修族谱序 (1524年)")
    print("5: 高洲罗氏五续修族谱序 (1702年)")
    print("6: 高洲罗氏六续修族谱序 (1811年)")
    print("7: 高洲罗氏七续修族谱序——新序 (2008年)")
    print("8: 高洲罗氏六续修族谱序（黄周万撰）(1765年)")
    print("9: 东西塘罗氏庆源传 (1066年)")
    print("10: 临清派源流序 (1766年)")
else:
    print("无法找到标记位置，请检查文件格式")
