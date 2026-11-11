import { describe, expect, it } from 'vitest'
import { ALL_NON_SIHAT, ALL_SIHAT } from './bordxControlRules'
import { modeOptions, outstandingColumns, outstandingCsvRows, outstandingDefaults, outstandingParams, outstandingProblem } from './outstandingBordxRules'
import type { OutstandingResult, OutstandingRow } from './outstandingBordxRules'

describe('Outstanding Bordx checks', () => {
  const base = outstandingDefaults(new Date(2021, 5, 9))

  it('starts on a detail listing as at today', () => {
    expect(base).toEqual({ mode: 'detail', payor: '', asAt: '09/06/2021' })
    expect(modeOptions.map((o) => o.label)).toEqual(['Detail Listing', 'General Summary (S)', 'General Summary (N)'])
  })

  it('needs a payor for the detail listing of one payor, but not for an All or a summary', () => {
    expect(outstandingProblem(base)).toBe('Please Enter Payor Code.')
    expect(outstandingProblem({ ...base, payor: 'AB - A PAYOR' })).toBeNull()
    expect(outstandingProblem({ ...base, payor: ALL_SIHAT })).toBeNull()
    expect(outstandingProblem({ ...base, payor: ALL_NON_SIHAT })).toBeNull()
    expect(outstandingProblem({ ...base, mode: 'summaryS' })).toBeNull()
  })

  it('sends the mode, the scope, the payor code and the as at date as an ISO day', () => {
    expect(outstandingParams({ ...base, payor: 'ab - A PAYOR' })).toEqual({ mode: 'detail', scope: 'payor', payor: 'AB', asAt: '2021-06-09' })
    expect(outstandingParams({ ...base, payor: ALL_SIHAT })).toEqual({ mode: 'detail', scope: 'allSihat', payor: undefined, asAt: '2021-06-09' })
    expect(outstandingParams({ ...base, mode: 'summaryN' }).payor).toBeUndefined()
  })
})

describe('Outstanding Bordx lists', () => {
  const row = {
    item: 1,
    bordxNo: 'B1',
    payorCode: 'SH',
    claims: 2,
    amount: 1234.5,
    sentDate: '2021-05-01T00:00:00',
    days: 32,
    within14: null,
    over14: 1234.5,
  } as OutstandingRow

  it('heads each list as the desktop did', () => {
    expect(outstandingColumns('payor', false).map((c) => c.label)).toEqual([
      'Item No',
      'Bordx No',
      'Payor',
      'Amount',
      'DTP',
      'O/S Days',
      'Bordx <14 days',
      'Bordx >14 days',
    ])
    expect(outstandingColumns('mnrb', false)[4].label).toBe('DTMNRB')
    expect(
      outstandingColumns('nonSihat', false)
        .map((c) => c.label)
        .slice(4, 6),
    ).toEqual(['Date sent to Payor', 'No of Days O/S'])
    expect(outstandingColumns('payor', true).map((c) => c.label)).toEqual(['Item No', 'Payor', 'No of Claims', 'Amount'])
  })

  it('formats a line and writes the lists one after the other with their totals', () => {
    expect(outstandingColumns('payor', false).map((c) => c.value(row))).toEqual(['1', 'B1', 'SH', '1,234.50', '01/05/2021', '32', '', '1,234.50'])
    const result = {
      kind: 'S',
      mode: 'detail',
      asAt: '2021-06-09T00:00:00',
      totalDue: 1234.5,
      truncated: false,
      sections: [{ key: 'payor', title: 'Bordx with Payor', rows: [row], subTotal: 1234.5, within14: 0, over14: 1234.5 }],
    } as OutstandingResult
    expect(outstandingCsvRows(result)).toEqual([
      ['Bordx with Payor'],
      ['Item No', 'Bordx No', 'Payor', 'Amount', 'DTP', 'O/S Days', 'Bordx <14 days', 'Bordx >14 days'],
      ['1', 'B1', 'SH', '1,234.50', '01/05/2021', '32', '', '1,234.50'],
      ['Sub-Total', '', '', '1,234.50', '', '', '0.00', '1,234.50'],
      [],
    ])
  })
})
