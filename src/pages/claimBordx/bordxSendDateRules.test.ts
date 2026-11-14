import { describe, expect, it } from 'vitest'
import { canUpload, kindOptions, layoutHint, lineColumns, uploadLabel } from './bordxSendDateRules'
import type { SendDateLine, SendDateResult } from './bordxSendDateRules'

const line: SendDateLine = {
  line: 2,
  bordxNo: 'NAC0001926',
  amount: '100',
  appCode: 'ZZ0000000001',
  appDate: '04/11/2026',
  date: '05/11/2026',
  problems: ['Bordx No was not found.'],
}
const result = (over: Partial<SendDateResult> = {}): SendDateResult => ({ kind: 'send', rows: [line], errors: 0, updated: 0, message: '', ...over })

describe('Bordx Send Date uploads', () => {
  it('offers the three uploads of the desktop form with their buttons and columns', () => {
    expect(kindOptions.map((o) => o.value)).toEqual(['send', 'approval', 'return'])
    expect(uploadLabel).toEqual({ send: 'Send Date', approval: 'App Date', return: 'Return Date' })
    expect(layoutHint.send).toContain('T send date')
    expect(layoutHint.approval).toContain('H approval code')
  })

  it('lists the columns each upload reads, and the problem', () => {
    expect(lineColumns('send').map((c) => c.label)).toEqual(['Line No', 'Bordx No', 'Bordx Amount', 'Send Date', 'Problem'])
    expect(lineColumns('approval').map((c) => c.label)).toEqual(['Line No', 'Bordx No', 'Approval Code', 'Approval Date', 'Bordx Amount', 'Problem'])
    expect(lineColumns('return').map((c) => c.label)).toEqual([
      'Line No',
      'Bordx No',
      'Approval Code',
      'Approval Date',
      'Bordx Amount',
      'Return Date',
      'Problem',
    ])
    expect(lineColumns('return').map((c) => c.value(line))).toEqual([
      2,
      'NAC0001926',
      'ZZ0000000001',
      '04/11/2026',
      '100',
      '05/11/2026',
      'Bordx No was not found.',
    ])
  })

  it('uploads only after a clean verification of the same file and upload', () => {
    const file = new File(['x'], 'a.xlsx')
    const other = new File(['x'], 'b.xlsx')
    expect(canUpload(result(), 'send', file, file)).toBe(true)
    expect(canUpload(null, 'send', file, file)).toBe(false)
    expect(canUpload(result({ errors: 1 }), 'send', file, file)).toBe(false)
    expect(canUpload(result({ rows: [] }), 'send', file, file)).toBe(false)
    expect(canUpload(result(), 'return', file, file)).toBe(false)
    expect(canUpload(result(), 'send', file, other)).toBe(false)
    expect(canUpload(result({ updated: 1 }), 'send', file, file)).toBe(false)
  })
})
