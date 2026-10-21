import { describe, expect, it } from 'vitest'
import { tickable, tickedTotal } from './bankRules'
import type { BankPaymentRow } from './bankRules'

const row = (key: string, amount: number, problem: string | null = null): BankPaymentRow => ({
  key,
  payeeType: 'MEMBER',
  pvNo: key.slice(2),
  pvDate: null,
  creditDate: null,
  payee: 'X',
  bank: 'MALAYAN BANKING BERHAD',
  accountMasked: '****5678',
  amount,
  cases: 1,
  problem,
})

const rows = [row('M:CC1', 100), row('M:CC2', 50.5), row('H:CB1', 999, 'No bank account on record.')]

describe('tickable', () => {
  it('keeps only payments without a problem', () => {
    const { accepted, refused } = tickable(rows, new Set(['M:CC1', 'H:CB1', 'M:CC2']))
    expect([...accepted].sort()).toEqual(['M:CC1', 'M:CC2'])
    expect(refused).toBe(1)
  })
})

describe('tickedTotal', () => {
  it('adds the ticked amounts', () => expect(tickedTotal(rows, new Set(['M:CC1', 'M:CC2']))).toBe(150.5))
})
