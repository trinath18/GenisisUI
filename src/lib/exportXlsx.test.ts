import { describe, expect, it } from 'vitest'
import { buildXlsx, columnName, crc32, numberOf, sheetName, xlsxParts } from './exportXlsx'

/** Reads the stored entries of a zip (what buildXlsx writes) back into their text, checking each CRC. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const files: Record<string, string> = {}
  let at = 0
  while (view.getUint32(at, true) === 0x04034b50) {
    expect(view.getUint16(at + 8, true)).toBe(0) // stored
    const crc = view.getUint32(at + 14, true)
    const size = view.getUint32(at + 18, true)
    const nameLength = view.getUint16(at + 26, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength))
    const data = bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + size)
    expect(crc32(data)).toBe(crc)
    files[name] = new TextDecoder().decode(data)
    at += 30 + nameLength + size
  }
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50) // end of central directory
  expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(Object.keys(files).length)
  return files
}

describe('the Excel export', () => {
  it('names columns as Excel does and reads amounts written as text', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
    expect(numberOf('1,234.50')).toBe(1234.5)
    expect(numberOf('(12.00)')).toBe(-12)
    expect(numberOf('-3')).toBe(-3)
    expect(numberOf(7)).toBe(7)
    expect(numberOf('')).toBeNull()
    expect(numberOf('12/08/2021')).toBeNull()
    expect(numberOf('AB0001')).toBeNull()
  })

  it('works out the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926')
  })

  it('keeps sheet names to what Excel accepts', () => {
    expect(sheetName('Worksheet Send to A/C')).toBe('Worksheet Send to A C')
    expect(sheetName('x'.repeat(40))).toHaveLength(31)
    expect(sheetName(' / ')).toBe('Sheet1')
  })

  it('writes a workbook whose parts unzip intact, with headings, numbers as numbers and text escaped', () => {
    const blocks = [
      {
        heading: 'Benefits',
        columns: [{ label: 'Benefit' }, { label: 'Approved', numeric: true }],
        rows: [
          ['Room & Board <ICU>', '1,200.50'],
          ['Total', '1,200.50'],
          ['Nothing', ''],
        ],
      },
      { heading: 'Summary', columns: [{ label: 'Item' }, { label: 'Value', numeric: true }], rows: [['Excess Collected By', 'Medix']] },
    ]
    const files = unzip(buildXlsx('Worksheet AB0001 version 1', blocks))
    expect(Object.keys(files).sort()).toEqual(Object.keys(xlsxParts('x', blocks)).sort())
    expect(files['xl/workbook.xml']).toContain('<sheet name="Worksheet AB0001 version 1"')
    const sheet = files['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="2"><is><t xml:space="preserve">Benefits</t></is></c>')
    expect(sheet).toContain('<c r="B2" t="inlineStr" s="1"><is><t xml:space="preserve">Approved</t></is></c>')
    expect(sheet).toContain('Room &amp; Board &lt;ICU&gt;')
    expect(sheet).toContain('<c r="B3" s="3"><v>1200.5</v></c>')
    // The empty amount leaves its cell out; the second list starts after a blank line.
    expect(sheet).toContain('<row r="5"><c r="A5" t="inlineStr"><is><t xml:space="preserve">Nothing</t></is></c></row>')
    expect(sheet).toContain('<row r="7"><c r="A7" t="inlineStr" s="2"><is><t xml:space="preserve">Summary</t></is></c></row>')
    // A text value in an amount column stays text.
    expect(sheet).toContain('<c r="B9" t="inlineStr"><is><t xml:space="preserve">Medix</t></is></c>')
  })
})
