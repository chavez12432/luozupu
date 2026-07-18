/**
 * 将族人库按民国元年（1912）拆为古代 / 现代两个紧凑 JSON（pkg-local 分包）
 * 用法：node scripts/splitMembersAncientModern.js
 */
const { PATHS, parseMembersFile, writeSplitFiles } = require('../utils/memberDbSplit');

function main() {
  const source = parseMembersFile(PATHS.membersAll);
  if (!source.length) {
    console.error('未找到族人数据:', PATHS.membersAll);
    process.exit(1);
  }

  const stats = writeSplitFiles(source);
  const fs = require('fs');

  console.log(
    JSON.stringify(
      {
        boundary: '民国元年 = 1912',
        ...stats,
        files: {
          ancient: PATHS.ancient,
          modern: PATHS.modern,
          adminMerge: PATHS.membersAll
        },
        bytes: {
          ancient: fs.statSync(PATHS.ancient).size,
          modern: fs.statSync(PATHS.modern).size,
          merge: fs.statSync(PATHS.membersAll).size
        }
      },
      null,
      2
    )
  );
}

main();
