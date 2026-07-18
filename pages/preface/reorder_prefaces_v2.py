#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
重新排列族谱序的ID顺序 - 版本2
原顺序: 1=七续修(2008), 2=首修(1174), 3=二修(1409), 4=三修(1423), 5=四修(1524), 6=五修(1702), 7=六修(1811), 8=黄周万(1765), 9=庆源传(1066), 10=临清派(1766)
新顺序: 1=首修(1174), 2=二修(1409), 3=三修(1423), 4=四修(1524), 5=五修(1702), 6=六修(1811), 7=七续修(2008), 8=黄周万(1765), 9=庆源传(1066), 10=临清派(1766)
"""

import re

# 读取原文件
with open('detail.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 定义每个ID对应的内容块（使用更精确的匹配）
# 我们需要手动提取每个预face的内容

# 首先找到prefaceContents的开始位置
start_marker = '  // 八篇族谱序的完整内容\n  prefaceContents: {'
start_idx = content.find(start_marker)

# 找到onLoad函数的开始位置（prefaceContents的结束）
end_marker = '\n  },\n\n  onLoad'
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"无法找到标记位置: start_idx={start_idx}, end_idx={end_idx}")
    exit(1)

# 提取prefaceContents的内容
preface_section = content[start_idx + len(start_marker):end_idx]

# 使用正则表达式提取每个ID对应的内容块
# 匹配模式: ID: { ... },
pattern = r'\n    (\d+): \{([\s\S]*?)\n    \}(?=,|\n  \})'
matches = list(re.finditer(pattern, preface_section))

print(f"找到 {len(matches)} 个匹配项")

# 创建ID到内容的映射
id_to_content = {}
for match in matches:
    old_id = int(match.group(1))
    content_block = match.group(2)
    id_to_content[old_id] = content_block
    print(f"  ID {old_id}: 内容长度 {len(content_block)}")

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

# 按新ID排序
new_order = sorted(id_mapping.items(), key=lambda x: x[1])

# 构建新的prefaceContents
new_prefaces = []
for old_id, new_id in new_order:
    if old_id in id_to_content:
        content_block = id_to_content[old_id]
        new_entry = f'\n    {new_id}: {{{content_block}\n    }}'
        new_prefaces.append(new_entry)

new_preface_section = '  // 八篇族谱序的完整内容\n  prefaceContents: {' + ','.join(new_prefaces) + '\n  }'

# 构建完整的新文件内容
new_content = content[:start_idx] + new_preface_section + content[end_idx + 3:]

# 写入新文件
with open('detail.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("\n文件已成功更新!")
print("\n新的ID顺序:")
print("1: 高洲罗氏首修族谱序 (1174年) - 原ID 2")
print("2: 高洲罗氏二次增修族谱序 (1409年) - 原ID 3")
print("3: 双池府君三次增修族谱序 (1423年) - 原ID 4")
print("4: 高洲罗氏四续修族谱序 (1524年) - 原ID 5")
print("5: 高洲罗氏五续修族谱序 (1702年) - 原ID 6")
print("6: 高洲罗氏六续修族谱序 (1811年) - 原ID 7")
print("7: 高洲罗氏七续修族谱序——新序 (2008年) - 原ID 1")
print("8: 高洲罗氏六续修族谱序（黄周万撰）(1765年) - 原ID 8")
print("9: 东西塘罗氏庆源传 (1066年) - 原ID 9")
print("10: 临清派源流序 (1766年) - 原ID 10")
