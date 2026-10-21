import { describe, expect, it } from 'vitest'
import { reissueProblem, statusLabel, stopProblem } from './voucherRules'

const active = { pvNo: 'CB00109300', status: 'A', amount: 117.5, stoppedAs: null, reissuedAs: null }

describe('stopProblem', () => {
  it('allows an active or re-issued payment not yet stopped', () => {
    expect(stopProblem(active)).toBeNull()
    expect(stopProblem({ ...active, status: 'R' })).toBeNull()
  })
  it('refuses a stop row and a payment already stopped', () => {
    expect(stopProblem({ ...active, status: 'C', amount: -117.5 })).toBe('PV CB00109300 is not an active payment, so it cannot be stopped.')
    expect(stopProblem({ ...active, stoppedAs: 'E' })).toBe('PV CB00109300 has already been stopped (E).')
  })
})

describe('reissueProblem', () => {
  it('needs a stop first and only one re-issue', () => {
    expect(reissueProblem(active)).toBe('PV CB00109300 has not been stopped. Cancel or expire it first.')
    expect(reissueProblem({ ...active, stoppedAs: 'C' })).toBeNull()
    expect(reissueProblem({ ...active, stoppedAs: 'C', reissuedAs: 'CB00111427' })).toBe('PV CB00109300 has already been re-issued as CB00111427.')
  })
})

describe('statusLabel', () => {
  it('names the desktop codes', () => {
    expect(statusLabel('A')).toBe('A - Active')
    expect(statusLabel('E')).toBe('E - Expired')
    expect(statusLabel(null)).toBe('')
  })
})
