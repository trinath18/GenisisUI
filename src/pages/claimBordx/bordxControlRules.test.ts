import { describe, expect, it } from 'vitest'
import { ALL_NON_SIHAT, ALL_SIHAT, controlColumns, controlDefaults, controlParams, controlProblem, kindOf, payorCodeOf, scopeOf } from './bordxControlRules'
import type { ControlPayor, ControlRow } from './bordxControlRules'

const payors: ControlPayor[] = [
  { code: 'AB', name: 'A PAYOR', healthCode: 'N' },
  { code: 'SH', name: 'SIHAT', healthCode: 'S' },
  { code: 'XX', name: 'NO KIND', healthCode: null },
]

describe('Bordx Control checks', () => {
  it('needs a payor unless an All is chosen', () => {
    expect(controlProblem({ payor: ' ' })).toBe('Please Enter Payor Code.')
    expect(controlProblem({ payor: ALL_SIHAT })).toBeNull()
    expect(controlProblem({ payor: 'AB - A PAYOR' })).toBeNull()
  })

  it('reads the scope and the payor code from the box', () => {
    expect([scopeOf(ALL_SIHAT), scopeOf(ALL_NON_SIHAT), scopeOf('AB - A PAYOR')]).toEqual(['allSihat', 'allNonSihat', 'payor'])
    expect(payorCodeOf('ab - A PAYOR')).toBe('AB')
  })

  it('takes the layout from the payor health code, a missing one as Sihat, like the desktop', () => {
    expect([kindOf('AB - A PAYOR', payors), kindOf('SH', payors), kindOf('XX', payors), kindOf('QQ', payors), kindOf('', payors)]).toEqual([
      'N',
      'S',
      'S',
      undefined,
      undefined,
    ])
    expect([kindOf(ALL_SIHAT, payors), kindOf(ALL_NON_SIHAT, payors)]).toEqual(['S', 'N'])
  })
})

describe('Bordx Control request and columns', () => {
  it('starts the radio groups on Both, with To MNRB keeping bordx that have a To MNRB status', () => {
    expect(controlParams({ ...controlDefaults, payor: 'AB - A PAYOR' })).toEqual({
      scope: 'payor',
      payor: 'AB',
      bordxFrom: undefined,
      bordxTo: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      payTo: undefined,
      payDocFr: undefined,
      mnrbTo: 'B',
      mnrbFr: undefined,
      payFr: undefined,
    })
  })

  it('sends the dates as ISO days and no payor for an All scope', () => {
    const p = controlParams({ ...controlDefaults, payor: ALL_NON_SIHAT, dateFrom: '01/02/2021', payFr: 'F', payTo: '1' })
    expect([p.scope, p.payor, p.dateFrom, p.payFr, p.payTo]).toEqual(['allNonSihat', undefined, '2021-02-01', 'F', '1'])
  })

  it('has the desktop headings of each layout and a Payor column for the All lists', () => {
    expect(controlColumns('N', false).map((c) => c.label)).toEqual([
      'Bordx No',
      'Bordx Date',
      'No of Claims',
      'Bordx Amt',
      'Bordx Status',
      'DTP',
      'DRP (Doc)',
      'No of Days (DRP - DTP)',
      'DFPayor (Money)',
      'No of Days (DTP - DPayment)',
    ])
    expect(controlColumns('S', true).map((c) => c.label)).toEqual([
      'Payor',
      'Bordx No',
      'Bordx Date',
      'No of Claims',
      'Bordx Amt',
      'Bordx Status',
      'DTP',
      'DRP (Doc)',
      'No of Days (DRP - DTP)',
      'DTMNRB',
      'DFMNRB (Money)',
      'No of Days (Date Fr MNRB - Date to MNRB)',
      'Total Days',
    ])
  })

  it('formats a row for the file', () => {
    const row = {
      payorCode: 'AB',
      bordxNo: 'B1',
      bordxDate: '2021-02-01T00:00:00',
      claims: 3,
      amount: 1234.5,
      status: 'C',
      sentToPayor: null,
      docReceived: null,
      days: null,
      moneyFromPayor: '2021-03-01T00:00:00',
      days2: 1,
    } as ControlRow
    expect(controlColumns('N', false).map((c) => c.value(row))).toEqual(['B1', '01/02/2021', '3', '1,234.50', 'C', '', '', '', '01/03/2021', '1'])
  })
})
