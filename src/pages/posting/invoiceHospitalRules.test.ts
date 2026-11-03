import { describe, expect, it } from 'vitest'
import { hospitalDefaults, isoDay, journalRows, payorsOf, pickedIndexes, postProblem, postRequest, searchParams } from './invoiceHospitalRules'
import type { HospitalValues, PayorOption } from './invoiceHospitalRules'
import type { JournalLine } from '../../features/finance/sunPosting/types'

const v = (over: Partial<HospitalValues> = {}): HospitalValues => ({ ...hospitalDefaults, ...over })
const line = (over: Partial<JournalLine> = {}): JournalLine => ({
  status: '',
  journalType: 'RC',
  journalSource: '',
  database: 'MED',
  transRef: 'I18-1',
  accPeriod: '02/2021',
  transDate: '2021-08-04T00:00:00',
  description: 'A PATIENT',
  accCode: '6000AC',
  amount: 100,
  debitCredit: 'D',
  hospital: '3G004',
  groupCompany: '',
  payor: 'AC',
  caseNo: '00001618-2',
  productCategory: 'NS',
  bordxRef: '0002381',
  batchNo: null,
  index: null,
  invoiceCaseNo: '7',
  invoiceVersion: '',
  ...over,
})

describe('Hospital invoice posting criteria', () => {
  it('starts on not posted and bordx yes and sends only what was filled in', () => {
    expect([hospitalDefaults.postStatus, hospitalDefaults.bordxStatus]).toEqual(['0', '1'])
    expect(
      searchParams('all', v({ hospital: ' H1 ', payor: 'AC - ALLIANZ', invoiceDateFrom: '01/09/2026', invoiceNoTo: ' I9 ', batchNoFrom: '4949' })),
    ).toEqual({
      mode: 'all',
      healthType: undefined,
      hospital: 'H1',
      payor: 'AC',
      invoiceDateFrom: '2026-09-01',
      invoiceDateTo: undefined,
      invoiceNoFrom: undefined,
      invoiceNoTo: 'I9',
      postStatus: '0',
      postDateFrom: undefined,
      postDateTo: undefined,
      bordxStatus: '1',
      batchNoFrom: '4949',
      batchNoTo: undefined,
      bordxDateFrom: undefined,
      bordxDateTo: undefined,
    })
    expect(searchParams('credit', v()).mode).toBe('credit')
    expect(isoDay('30/10/2026')).toBe('2026-10-30')
    expect(isoDay('')).toBeUndefined()
  })

  it('offers the payors of the health type chosen, or all of them', () => {
    const payors: PayorOption[] = [
      { code: 'AC', name: 'ALLIANZ', healthType: 'N' },
      { code: 'ST', name: 'TAKAFUL', healthType: 'S' },
      { code: 'XX', name: 'NONE', healthType: null },
    ]
    expect(payorsOf(payors, '').map((p) => p.code)).toEqual(['AC', 'ST', 'XX'])
    expect(payorsOf(payors, 'S').map((p) => p.code)).toEqual(['ST'])
  })
})

describe('Posting', () => {
  it('ticks the invoices by their index once each, whichever of the two lines is ticked', () => {
    const lines = [
      { ...line(), key: 'a#0', index: null },
      { ...line({ debitCredit: 'C', index: '7' }), key: 'a#1' },
      { ...line({ invoiceCaseNo: '8' }), key: 'b#2', index: null },
      { ...line({ invoiceCaseNo: '8', debitCredit: 'C', index: '8' }), key: 'b#3' },
    ]
    expect(pickedIndexes(lines, new Set(['a#0', 'a#1', 'b#3']))).toEqual(['7', '8'])
    expect(pickedIndexes(lines, new Set())).toEqual([])
  })

  it('checks Post in the desktop order with its messages', () => {
    const ok = { picked: 1, invoiceDateTo: '30/10/2026', bordxStatus: '1', posted: false, accPeriod: '10/2026' }
    expect(postProblem({ ...ok, picked: 0 })).toBe('Please select the record')
    expect(postProblem({ ...ok, invoiceDateTo: '' })).toBe('Please Enter Invoice Date(To)')
    expect(postProblem({ ...ok, bordxStatus: '0' })).toBe('Please Change Bordx Status')
    expect(postProblem({ ...ok, posted: true })).toBe('Record(s) has been posted ! ')
    expect(postProblem({ ...ok, accPeriod: ' ' })).toBe('Please Keyin for Accounting Period ! ')
    expect(postProblem(ok)).toBeNull()
    expect(postRequest(v({ accPeriod: '10/2026', invoiceDateTo: '30/10/2026' }), ['7', '8'])).toEqual({
      accPeriod: '10/2026',
      invoiceDateTo: '2026-10-30',
      bordxStatus: '1',
      invoiceIndexes: ['7', '8'],
    })
  })

  it('writes the listed lines as the desktop exported them', () => {
    const rows = journalRows([line({ status: 'Post', batchNo: '4949' }), line({ debitCredit: 'C', accCode: '83G004', index: '7' })])
    expect(rows[0]).toHaveLength(19)
    expect(rows[0].slice(0, 5)).toEqual(['Chk', 'J/T', 'J/S', 'DB', 'Trans.Ref.'])
    expect(rows[1]).toEqual([
      'Post',
      'RC',
      '',
      'MED',
      'I18-1',
      '02/2021',
      '04/08/2021',
      'A PATIENT',
      '6000AC',
      '100.00',
      'D',
      '3G004',
      '',
      'AC',
      '00001618-2',
      'NS',
      '0002381',
      '4949',
      '',
    ])
    expect(rows[2].slice(8, 11)).toEqual(['83G004', '100.00', 'C'])
    expect(rows[2].at(-1)).toBe('7')
  })
})
