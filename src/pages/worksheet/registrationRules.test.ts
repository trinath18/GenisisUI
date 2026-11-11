import { describe, expect, it } from 'vitest'
import { daysText, differingRows, limitDiffers, sameEffect, summaryRows } from './registrationRules'
import type { CalculationLine, CalculationSummary } from './registrationRules'

const line = (over: Partial<CalculationLine>): CalculationLine => ({
  slot: 1,
  category: null,
  benefit: 'Row',
  limit: null,
  savedLimit: null,
  actual: 100,
  approved: 0,
  toHospital: 0,
  toMember: 0,
  ...over,
})

describe('sameEffect', () => {
  it.each([
    ['FULL', 'full', true],
    ['1,000.00', '1000', true],
    ['0.00', '-', true],
    ['0.00', null, true],
    [null, '', true],
    ['FULL', '-', false],
    ['100.00', 'FULL', false],
    ['100.00', '99.99', false],
  ])('%s vs %s is %s', (a, b, same) => expect(sameEffect(a, b)).toBe(same))
})

describe('limitDiffers', () => {
  it('compares only rows that have an amount and a saved limit', () => {
    expect(limitDiffers(line({ limit: 'FULL', savedLimit: '50.00' }))).toBe(true)
    expect(limitDiffers(line({ limit: 'FULL', savedLimit: '50.00', actual: 0 }))).toBe(false)
    expect(limitDiffers(line({ limit: 'FULL', savedLimit: null }))).toBe(false)
    expect(limitDiffers(line({ limit: null, savedLimit: '-' }))).toBe(false)
  })

  it('lists the rows that differ', () => {
    const rows = [line({ slot: 1, limit: 'FULL', savedLimit: 'FULL' }), line({ slot: 3, limit: null, savedLimit: 'FULL' })]
    expect(differingRows(rows).map((r) => r.slot)).toEqual([3])
  })
})

describe('summaryRows', () => {
  const calc: CalculationSummary = { sumApproved: 1000, coPayment: 100, limitExceeded: 0, totalApproved: 900, previousBalance: 5000 }

  it('has nothing without a calculation', () => expect(summaryRows(null, null)).toEqual([]))

  it('shows the calculated figures alone when nothing was saved', () => {
    const rows = summaryRows(calc, null)
    expect(rows.map((r) => r.label)).toEqual(['Sum of approved', 'Co-payment', 'Limit exceeded', 'Total approved', 'Limit before the worksheet'])
    expect(rows.every((r) => !r.differs && r.saved === '')).toBe(true)
  })

  it('marks a figure that differs from the saved one by a cent or more', () => {
    const rows = summaryRows(calc, { sumApproved: 0, coPayment: 100, limitExceeded: 0, totalApproved: 899.99, previousBalance: 5000 })
    expect(rows.filter((r) => r.differs).map((r) => r.label)).toEqual(['Total approved'])
  })
})

describe('daysText', () => {
  it.each([
    [2, '2'],
    [7.5, '7.5'],
    [0, '0'],
  ])('%s days is %s', (d, t) => expect(daysText(d)).toBe(t))
})
