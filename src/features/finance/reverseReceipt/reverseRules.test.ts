import { describe, expect, it } from 'vitest'
import { currentPeriod, reversalProblem, reverseProblem } from './reverseRules'

describe('reverseProblem', () => {
  const receipt = { receiptNo: 'RB55092', amount: 5413.35, isReversal: false, reversedBy: null }
  it('accepts a positive receipt not yet reversed', () => expect(reverseProblem(receipt)).toBeNull())
  it('refuses a receipt without a number, a reversal and a reversed receipt', () => {
    expect(reverseProblem({ ...receipt, receiptNo: ' ' })).toBe('A receipt without a receipt number cannot be reversed.')
    expect(reverseProblem({ ...receipt, amount: -5 })).toContain('is a reversal')
    expect(reverseProblem({ ...receipt, isReversal: true })).toContain('is a reversal')
    expect(reverseProblem({ ...receipt, reversedBy: 'RB55641' })).toBe('Receipt RB55092 has already been reversed by RB55641.')
  })
})

describe('reversalProblem', () => {
  it('checks date, then period, then its format', () => {
    expect(reversalProblem({ reversalDate: '', accPeriod: '' })).toBe('Please Enter Reversal Date')
    expect(reversalProblem({ reversalDate: '10/08/2021', accPeriod: '' })).toBe('Please Keyin for Accounting Period ! ')
    expect(reversalProblem({ reversalDate: '10/08/2021', accPeriod: '13/2021' })).toBe('Select a valid accounting period.')
    expect(reversalProblem({ reversalDate: '10/08/2021', accPeriod: '08/2021' })).toBeNull()
  })

  it('defaults the period to the current month', () => expect(currentPeriod(new Date(2021, 7, 10))).toBe('08/2021'))
})
