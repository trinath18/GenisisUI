// A small .xlsx writer for the Export button: one or more lists on one sheet, each with a bold heading row, numbers stored as
// numbers and text as text. The workbook is a zip of a few XML parts (stored, not compressed), so no library is needed.

export type XlsxCell = string | number | null | undefined

/** One list on the sheet: an optional title line, the column headings and the rows. */
export interface XlsxBlock {
  heading?: string
  columns: { label: string; numeric?: boolean }[]
  rows: XlsxCell[][]
}

const xmlText = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // XML 1.0 cannot carry most control characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

/** "A", "B", … "Z", "AA", … for a zero-based column. */
export function columnName(index: number): string {
  let n = index + 1
  let name = ''
  while (n > 0) {
    const r = (n - 1) % 26
    name = String.fromCharCode(65 + r) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

/** The number a numeric column's text stands for ("1,234.50" and "(12.00)" included), or null when it is not one. */
export function numberOf(value: XlsxCell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = (value ?? '').trim()
  if (!/^\(?-?[\d,]*\.?\d+\)?$/.test(text)) return null
  const negative = text.startsWith('(') && text.endsWith(')')
  const n = Number(text.replace(/[(),]/g, ''))
  return Number.isFinite(n) ? (negative ? -n : n) : null
}

const STYLE_HEADING = 1
const STYLE_TITLE = 2
const STYLE_AMOUNT = 3

function sheetXml(blocks: XlsxBlock[]): string {
  const rows: string[] = []
  const widths: number[] = []
  const note = (col: number, text: string) => (widths[col] = Math.min(60, Math.max(widths[col] ?? 8, text.length + 2)))
  let r = 0
  const textCell = (c: number, text: string, style = 0) => {
    note(c, text)
    return `<c r="${columnName(c)}${r}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`
  }
  blocks.forEach((block, b) => {
    if (b > 0) r++ // a blank line between lists
    if (block.heading) {
      r++
      rows.push(`<row r="${r}">${textCell(0, block.heading, STYLE_TITLE)}</row>`)
      widths[0] = Math.max(widths[0] ?? 8, 8) // the title may run across the columns
    }
    r++
    rows.push(`<row r="${r}">${block.columns.map((col, c) => textCell(c, col.label, STYLE_HEADING)).join('')}</row>`)
    for (const row of block.rows) {
      r++
      const cells = block.columns.map((col, c) => {
        const value = row[c]
        const n = col.numeric ? numberOf(value) : typeof value === 'number' ? value : null
        if (n !== null) {
          note(c, String(value ?? ''))
          return `<c r="${columnName(c)}${r}"${col.numeric ? ` s="${STYLE_AMOUNT}"` : ''}><v>${n}</v></c>`
        }
        const text = value == null ? '' : String(value)
        return text ? textCell(c, text) : ''
      })
      rows.push(`<row r="${r}">${cells.join('')}</row>`)
    }
  })
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w ?? 8}" customWidth="1"/>`).join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    (cols ? `<cols>${cols}</cols>` : '') +
    `<sheetData>${rows.join('')}</sheetData></worksheet>`
  )
}

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00;(#,##0.00)"/></numFmts>' +
  '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'

/** The sheet name Excel accepts: at most 31 characters, none of []:*?/\ . */
export const sheetName = (name: string) =>
  name
    .replace(/[[\]:*?/\\]/g, ' ')
    .trim()
    .slice(0, 31) || 'Sheet1'

/** The workbook's parts, by their path in the zip. */
export function xlsxParts(sheet: string, blocks: XlsxBlock[]): Record<string, string> {
  return {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${xmlText(sheetName(sheet))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': sheetXml(blocks),
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A zip archive of the files, stored without compression (what an .xlsx needs at minimum). */
export function zipStored(files: Record<string, string>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [path, text] of Object.entries(files)) {
    const name = encoder.encode(path)
    const data = encoder.encode(text)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // UTF-8 names
    lv.setUint16(8, 0, true) // stored
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, centrals.length, true)
  ev.setUint16(10, centrals.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  const out = new Uint8Array(offset + centralSize + end.length)
  let at = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at)
    at += part.length
  }
  return out
}

/** The .xlsx file of the lists. */
export function buildXlsx(sheet: string, blocks: XlsxBlock[]): Uint8Array<ArrayBuffer> {
  return zipStored(xlsxParts(sheet, blocks))
}
