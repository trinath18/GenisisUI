import { describe, expect, it } from 'vitest'
import { keyedLines, pairSelection, pickedInvoices, postProblem } from './journalRules'
import type { JournalLine } from './types'

const line = (cas: string, version = '1', over: Partial<JournalLine> = {}): JournalLine => ({
  status: '',
  journalType: 'MJC',
  journalSource: '',
  database: 'MED',
  transRef: `${cas}-${version}`,
  accPeriod: null,
  transDate: '2021-07-01T00:00:00',
  description: 'NAME',
  accCode: '8200ST',
  amount: 10,
  debitCredit: 'C',
  hospital: '0R',
  groupCompany: null,
  payor: 'ST',
  caseNo: cas.slice(2),
  productCategory: 'IP',
  bordxRef: null,
  batchNo: null,
  index: null,
  invoiceCaseNo: cas,
  invoiceVersion: version,
  ...over,
})

const rows = keyedLines([line('ST1'), line('ST1', '1', { debitCredit: 'D' }), line('ST2'), line('ST2', '1', { debitCredit: 'D' })])

describe('pairSelection (lstMBMInvList_ItemCheck)', () => {
  it('ticks both lines of an invoice when one is ticked', () => {
    expect([...pairSelection(rows, new Set(), new Set([rows[1].key]))].sort()).toEqual([rows[0].key, rows[1].key].sort())
  })

  it('unticks the pair when one line is unticked', () => {
    const all = new Set(rows.map((r) => r.key))
    const next = new Set(all)
    next.delete(rows[2].key)
    expect([...pairSelection(rows, all, next)].sort()).toEqual([rows[0].key, rows[1].key].sort())
  })

  it('keeps select-all and clear-all as they are', () => {
    expect(pairSelection(rows, new Set(), new Set(rows.map((r) => r.key))).size).toBe(4)
    expect(pairSelection(rows, new Set(rows.map((r) => r.key)), new Set()).size).toBe(0)
  })
})

describe('pickedInvoices', () => {
  it('lists each ticked invoice once', () => {
    expect(pickedInvoices(rows, new Set([rows[0].key, rows[1].key, rows[3].key]))).toEqual([
      { caseNo: 'ST1', claimVersion: '1' },
      { caseNo: 'ST2', claimVersion: '1' },
    ])
  })
})

describe('postProblem (CmdPost_Click)', () => {
  const ok = { picked: 1, invoiceDateTo: '31/08/2021', bordxStatus: '1', posted: false, accPeriod: '08/2021' }
  it('accepts a complete post', () => expect(postProblem(ok)).toBeNull())
  it('checks in the desktop order', () => {
    expect(postProblem({ ...ok, picked: 0, invoiceDateTo: '' })).toBe('Please select the record')
    expect(postProblem({ ...ok, invoiceDateTo: '', bordxStatus: '0' })).toBe('Please Enter Invoice Date(To)')
    expect(postProblem({ ...ok, bordxStatus: '0', posted: true })).toBe('Please change Bordx Status')
    expect(postProblem({ ...ok, posted: true, accPeriod: '' })).toBe('Record(s) has been posted ! ')
    expect(postProblem({ ...ok, accPeriod: ' ' })).toBe('Please Keyin for Accounting Period ! ')
  })
})
