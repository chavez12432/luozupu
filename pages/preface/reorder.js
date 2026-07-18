// 读取detail.js并重新排列族谱序的ID顺序
const fs = require('fs');

// 读取文件
let content = fs.readFileSync('detail.js', 'utf8');

// 定义ID映射关系: 旧ID -> 新ID
const idMapping = {
  2: 1,   // 首修(1174) -> id 1
  3: 2,   // 二修(1409) -> id 2
  4: 3,   // 三修(1423) -> id 3
  5: 4,   // 四修(1524) -> id 4
  6: 5,   // 五修(1702) -> id 5
  7: 6,   // 六修(1811) -> id 6
  1: 7,   // 七续修(2008) -> id 7
  8: 8,   // 黄周万(1765) -> id 8
  9: 9,   // 庆源传(1066) -> id 9
  10: 10  // 临清派(1766) -> id 10
};

// 提取prefaceContents部分
const startMarker = '  // 八篇族谱序的完整内容\n  prefaceContents: {';
const endMarker = '  },\n\n  onLoad';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('无法找到标记位置');
  process.exit(1);
}

// 提取每个ID对应的内容块
const prefaceSection = content.substring(startIdx + startMarker.length, endIdx);

// 使用正则表达式匹配每个条目
const entries = {};
const regex = /\n    (\d+): \{([\s\S]*?)(\n    \})(?=,|\n  \})/g;
let match;

while ((match = regex.exec(prefaceSection)) !== null) {
  const id = parseInt(match[1]);
  const contentBlock = match[2];
  entries[id] = contentBlock;
  console.log(`找到 ID ${id}`);
}

// 按新ID排序并构建新的内容
const newEntries = [];
const sortedMapping = Object.entries(idMapping).sort((a, b) => a[1] - b[1]);

for (const [oldId, newId] of sortedMapping) {
  const oldIdNum = parseInt(oldId);
  if (entries[oldIdNum]) {
    newEntries.push(`\n    ${newId}: {${entries[oldIdNum]}\n    }`);
    console.log(`映射: 旧ID ${oldId} -> 新ID ${newId}`);
  }
}

// 构建新的文件内容
const newPrefaceSection = '  // 八篇族谱序的完整内容\n  prefaceContents: {' + newEntries.join(',') + '\n  }';
const newContent = content.substring(0, startIdx) + newPrefaceSection + content.substring(endIdx + 3);

// 写入文件
fs.writeFileSync('detail.js', newContent, 'utf8');

console.log('\n文件已成功更新!');
console.log('\n新的ID顺序:');
console.log('1: 高洲罗氏首修族谱序 (1174年)');
console.log('2: 高洲罗氏二次增修族谱序 (1409年)');
console.log('3: 双池府君三次增修族谱序 (1423年)');
console.log('4: 高洲罗氏四续修族谱序 (1524年)');
console.log('5: 高洲罗氏五续修族谱序 (1702年)');
console.log('6: 高洲罗氏六续修族谱序 (1811年)');
console.log('7: 高洲罗氏七续修族谱序——新序 (2008年)');
console.log('8: 高洲罗氏六续修族谱序（黄周万撰）(1765年)');
console.log('9: 东西塘罗氏庆源传 (1066年)');
console.log('10: 临清派源流序 (1766年)');
