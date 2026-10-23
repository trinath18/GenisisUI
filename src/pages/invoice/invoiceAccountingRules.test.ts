import { describe, expect, it } from 'vitest'
import {
  afterPrint,
  batchParts,
  bracketMoney,
  creditText,
  debitCredit,
  debitText,
  hospitalDefaults,
  hospitalParams,
  hospitalSchema,
  memberDefaults,
  memberParams,
  memberSchema,
  payorOf,
  periodMonthOptions,
  periodProblem,
  periodRequest,
  periodYearOptions,
  totalPayable,
  withKeys,
} from './invoiceAccountingRules'
import type { AccountingAmounts, MemberAccountingRow } from './invoiceAccountingRules'

const row = (over: Partial<AccountingAmounts> = {}): AccountingAmounts => ({
  key: '0',
  payable: 100,
  previousAmount: null,
  batchDate: null,
  batchNo: null,
  debit: null,
  credit: 100,
  ...over,
})

describe('debitCredit', () => {
  it.each([
    [100, 150, null, 50],
    [100, 100, null, 0],
    [150, 100, 50, null],
    [-30, 100, null, 70],
    [-30, -100, 70, null],
    [100, -40, 40, null],
    [0, 25, null, 25],
    [null, 80, null, 80],
  ])('previous %s, payable %s gives debit %s and credit %s', (previous, payable, debit, credit) => {
    expect(debitCredit(previous, payable)).toEqual({ debit, credit })
  })

  it('treats a missing payable as nothing', () => expect(debitCredit(null, null)).toEqual({ debit: null, credit: 0 }))
})

describe('the money columns', () => {
  it('shows a debit without its sign, a credit in brackets and nothing as 0.00', () => {
    expect(debitText({ debit: 1234.5 })).toBe('1,234.50')
    expect(debitText({ debit: null })).toBe('')
    expect(creditText({ credit: 50 })).toBe('(50.00)')
    expect(creditText({ credit: 0 })).toBe('0.00')
    expect(creditText({ credit: null })).toBe('')
  })

  it('writes a negative amount in brackets', () => {
    expect(bracketMoney(-12.5)).toBe('(12.50)')
    expect(bracketMoney(1234)).toBe('1,234.00')
    expect(bracketMoney(null)).toBe('')
  })
})

describe('batchParts and afterPrint', () => {
  it('splits a batch label into its date and its number of the day', () => {
    expect(batchParts('H23102026-4')).toEqual({ batchDate: 'H23102026', batchNo: 4 })
    expect(batchParts('M01022026-12')).toEqual({ batchDate: 'M01022026', batchNo: 12 })
    expect(batchParts('M01022026')).toEqual({ batchDate: 'M01022026', batchNo: null })
  })

  it('marks the listed rows with the batch and the payable amount as the previous amount', () => {
    const [marked] = afterPrint([row({ payable: 80, previousAmount: 30, credit: 50 })], 'H23102026-2')
    expect(marked).toMatchObject({ batchDate: 'H23102026', batchNo: 2, previousAmount: 80, credit: 0, debit: null })
  })

  it('leaves the rows the print does not mark', () => {
    const rows = [row({ key: '0' }), row({ key: '1' })]
    const [first, second] = afterPrint(rows, 'M01022026-1', (r) => r.key === '1')
    expect(first).toBe(rows[0])
    expect(second.batchNo).toBe(1)
  })
})

describe('withKeys and totalPayable', () => {
  it('gives every row a key of its own', () => expect(withKeys([{ a: 1 }, { a: 1 }]).map((r) => r.key)).toEqual(['0', '1']))

  it('adds up what is payable, a missing amount as nothing', () =>
    expect(totalPayable([row({ payable: 10.5 }), row({ payable: null }), row({ payable: 2 })])).toBe(12.5))
})

describe('the criteria forms', () => {
  it('check dates and batch numbers', () => {
    expect(hospitalSchema.isValidSync(hospitalDefaults)).toBe(true)
    expect(hospitalSchema.isValidSync({ ...hospitalDefaults, invoiceDateFrom: '31/02/2021' })).toBe(false)
    expect(hospitalSchema.isValidSync({ ...hospitalDefaults, batchNoFrom: '1.5' })).toBe(false)
    expect(hospitalSchema.isValidSync({ ...hospitalDefaults, printStatus: '' })).toBe(false)
    expect(memberSchema.isValidSync({ ...memberDefaults, bordxDateTo: 'abc' })).toBe(false)
    expect(memberSchema.isValidSync({ ...memberDefaults, batchNoTo: '12' })).toBe(true)
  })

  it('send ISO dates and numbers and leave empty criteria out', () => {
    expect(hospitalParams(hospitalDefaults)).toMatchObject({ printStatus: 'N', hospitalCode: undefined, invoiceDateFrom: undefined, batchNoFrom: undefined })
    expect(hospitalParams({ ...hospitalDefaults, hospitalCode: ' KBARU ', invoiceDateFrom: '01/08/2021', batchNoTo: '3', printStatus: 'R' })).toMatchObject({
      printStatus: 'R',
      hospitalCode: 'KBARU',
      invoiceDateFrom: '2021-08-01',
      batchNoTo: 3,
    })
    expect(memberParams({ ...memberDefaults, payor: 'XI - XYZ INSURANCE', closeDateTo: '31/12/2020' })).toMatchObject({
      payor: 'XI',
      closeDateTo: '2020-12-31',
    })
  })

  it('take the payor from the text before the dash', () => {
    expect(payorOf('XI - XYZ INSURANCE')).toBe('XI')
    expect(payorOf(' XI ')).toBe('XI')
    expect(payorOf('')).toBe('')
  })
})

describe('the A/C period update', () => {
  const values = { periodMonth: '7', periodYear: '2026' }

  it('checks the list, the month, the year and the ticks in the desktop order', () => {
    expect(periodProblem(values, 0, 0)).toEqual({ field: null, message: 'Please select a record(s) before proceeding!' })
    expect(periodProblem({ periodMonth: '', periodYear: '2026' }, 5, 1)).toEqual({ field: 'periodMonth', message: 'Month cannot be Empty.' })
    expect(periodProblem({ periodMonth: '7', periodYear: '' }, 5, 1)).toEqual({ field: 'periodYear', message: 'Year cannot be empty!' })
    expect(periodProblem(values, 5, 0)).toEqual({ field: null, message: 'Please select at least one record to be updated! ' })
    expect(periodProblem(values, 5, 2)).toBeNull()
  })

  it('sends each ticked worksheet version once', () => {
    const ticked = [
      { caseNo: 'AB1', version: '1' },
      { caseNo: 'AB1', version: '1' },
      { caseNo: 'AB2', version: '3' },
    ] as MemberAccountingRow[]
    expect(periodRequest(values, ticked)).toEqual({
      month: 7,
      year: 2026,
      items: [
        { caseNo: 'AB1', version: '1' },
        { caseNo: 'AB2', version: '3' },
      ],
    })
  })

  it('offers twelve months and the years from the next one back to 2000', () => {
    expect(periodMonthOptions.map((o) => o.label)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])
    const years = periodYearOptions(2026)
    expect([years[0].value, years[1].value, years.at(-1)?.value]).toEqual(['2027', '2026', '2000'])
  })
})
