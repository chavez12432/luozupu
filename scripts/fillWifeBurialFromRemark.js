/**
 * 从备注回填妻子表「墓葬地」
 * 规则：取妻子姓名后的葬地；丈夫葬地不取；合葬/同葬/共葬/附葬/仝葬可继承。
 * 默认只处理 Excel 第 74 行起；第 2–73 行保持不动。
 *
 * Usage:
 *   node scripts/fillWifeBurialFromRemark.js
 *   node scripts/fillWifeBurialFromRemark.js --write
 *   node scripts/fillWifeBurialFromRemark.js --from-row=74 --write
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const SOURCE =
  process.env.WIFE_XLSX ||
  'D:\\家谱\\database\\妻子表_校正版提取_20260717_1555.xlsx'
const WRITE = process.argv.includes('--write')
const FROM_ROW = (() => {
  const a = process.argv.find((x) => x.startsWith('--from-row='))
  return a ? Number(a.split('=')[1]) : 74
})()

const JOINT_BURIAL_RE = /[同合共附仝]葬/
const BURIAL_VERB_RE = /(?:殁)?(?:同|合|共|附|仝)?葬/
const STOP_CHARS = '。；;，,配继再娶侧室副室妾妣氏公讳字号生卒殁葬于在子生女'

function isWifeNameToken(token) {
  if (!token) return false
  const t = String(token).trim()
  if (!t || t.length > 12) return false
  if (/[0-9０-９]/.test(t)) return false
  if (/公|讳|字|号|配|继|再|娶|侧|副|妾|妣|葬|生|卒|殁|子|女/.test(t)) return false
  return /氏$/.test(t) || (t.length >= 2 && t.length <= 4)
}

function findWifeMentions(remark) {
  const text = String(remark || '')
  const mentions = []
  const re = /([配继再娶侧室副室妾妣]*)([\u4e00-\u9fff]{1,8}氏)/g
  let m
  while ((m = re.exec(text))) {
    const prefix = m[1] || ''
    const name = m[2]
    if (!isWifeNameToken(name)) continue
    mentions.push({
      name,
      index: m.index + prefix.length,
      fullIndex: m.index,
      prefix
    })
  }
  return mentions
}

function extractBurialPlace(segment) {
  const s = String(segment || '')
  const m = s.match(new RegExp(`${BURIAL_VERB_RE.source}([^${STOP_CHARS}]{1,40})`))
  if (!m) return ''
  let place = (m[1] || '').trim()
  place = place.replace(/[。；;，,、\s]+$/g, '')
  place = place.replace(/^(于|在)/, '')
  if (!place || place.length < 1) return ''
  if (/^(年月日时分)$/.test(place)) return ''
  return place
}

function segmentForWife(remark, wifeName, marriageOrder, allMentions) {
  const text = String(remark || '')
  if (!text) return { segment: '', mode: 'empty' }

  const sameName = allMentions.filter((x) => x.name === wifeName)
  let pick = null
  if (sameName.length === 0) {
    // 宽松：姓名可能不带「氏」后缀完全匹配
    const loose = allMentions.filter((x) => wifeName.includes(x.name) || x.name.includes(wifeName.replace(/氏$/, '')))
    if (loose.length) {
      const ord = Math.max(1, Number(marriageOrder) || 1)
      pick = loose[Math.min(ord, loose.length) - 1]
    }
  } else if (sameName.length === 1) {
    pick = sameName[0]
  } else {
    const ord = Math.max(1, Number(marriageOrder) || 1)
    pick = sameName[Math.min(ord, sameName.length) - 1]
  }

  if (!pick) {
    return { segment: text, mode: 'no-mention-fallback-full' }
  }

  const start = pick.index
  const next = allMentions.find((x) => x.fullIndex > pick.fullIndex)
  const end = next ? next.fullIndex : text.length
  return { segment: text.slice(start, end), mode: 'wife-segment', pick }
}

function resolveBurial(remark, wifeName, marriageOrder) {
  const allMentions = findWifeMentions(remark)
  const { segment, mode, pick } = segmentForWife(remark, wifeName, marriageOrder, allMentions)
  if (!segment) return { burial: '', reason: 'empty-remark', mode }

  // 妻段内直接葬地
  let burial = extractBurialPlace(segment)
  if (burial) {
    return { burial, reason: 'wife-segment-burial', mode, pick }
  }

  // 合葬类：可继承丈夫葬地（取妻名之前最近的葬地）
  if (JOINT_BURIAL_RE.test(segment) || /同葬|合葬|共葬|附葬|仝葬/.test(segment)) {
    const before = String(remark || '').slice(0, pick ? pick.fullIndex : 0)
    const husbandBurial = extractBurialPlace(before)
    if (husbandBurial) {
      // 若妻段是「同葬X」且已抽出 X，上面已返回；这里处理「同葬」无后续地名
      const jointPlace = extractBurialPlace(segment)
      return {
        burial: jointPlace || husbandBurial,
        reason: jointPlace ? 'joint-with-place' : 'joint-inherit-husband',
        mode,
        pick
      }
    }
    // 同葬后紧跟地名但 extract 已处理；无丈夫葬地时再试整段
    burial = extractBurialPlace(segment.replace(/^.*?氏/, ''))
    if (burial) return { burial, reason: 'joint-place-only', mode, pick }
  }

  return { burial: '', reason: 'no-burial-in-wife-segment', mode, pick }
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('文件不存在:', SOURCE)
    process.exit(1)
  }

  const wb = XLSX.readFile(SOURCE, { cellDates: true })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

  const report = {
    source: SOURCE,
    fromRow: FROM_ROW,
    write: WRITE,
    total: rows.length,
    filled: 0,
    skippedExisting: 0,
    skippedNoBurial: 0,
    skippedProtected: 0,
    samples: [],
    changes: []
  }

  // sheet_to_json 不含表头行；Excel 第 N 行 = rows[N-2]
  for (let i = 0; i < rows.length; i++) {
    const excelRow = i + 2
    const row = rows[i]
    const remark = String(row['备注'] || '')
    const wifeName = String(row['姓名'] || '').trim()
    const order = row['婚配序号']
    const existing = String(row['墓葬地'] || '').trim()

    if (excelRow < FROM_ROW) {
      report.skippedProtected++
      continue
    }

    if (existing) {
      report.skippedExisting++
      continue
    }

    const result = resolveBurial(remark, wifeName, order)
    if (!result.burial) {
      report.skippedNoBurial++
      if (report.samples.length < 30) {
        report.samples.push({
          excelRow,
          wifeName,
          order,
          reason: result.reason,
          remark: remark.slice(0, 160)
        })
      }
      continue
    }

    row['墓葬地'] = result.burial
    report.filled++
    report.changes.push({
      excelRow,
      id: row['ID'],
      husbandId: row['丈夫ID'],
      wifeName,
      order,
      burial: result.burial,
      reason: result.reason,
      remark: remark.slice(0, 120)
    })
  }

  const outDir = path.join(__dirname, '..', 'database')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const reportPath = path.join(outDir, 'wife_burial_fill_report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(JSON.stringify({
    source: SOURCE,
    fromRow: FROM_ROW,
    write: WRITE,
    total: report.total,
    filled: report.filled,
    skippedExisting: report.skippedExisting,
    skippedNoBurial: report.skippedNoBurial,
    skippedProtected: report.skippedProtected,
    reportPath
  }, null, 2))

  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --write to save Excel.')
    return
  }

  const newWs = XLSX.utils.json_to_sheet(rows)
  const newWb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(newWb, newWs, sheetName)

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
  const outCopy = path.join(path.dirname(SOURCE), `妻子表_校正版提取_墓葬回填_${stamp}.xlsx`)
  XLSX.writeFile(newWb, SOURCE)
  XLSX.writeFile(newWb, outCopy)
  console.log('Written:', SOURCE)
  console.log('Backup copy:', outCopy)
}

main()
