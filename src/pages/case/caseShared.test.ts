import { describe, expect, it } from 'vitest'
import { codeOf, dispDate, isoDmy, isoToDmy, num, S, unTilde } from './caseShared'

describe('case screen helpers', () => {
  it('S trims anything to text', () => {
    expect(S(null)).toBe('')
    expect(S(undefined)).toBe('')
    expect(S('  x ')).toBe('x')
    expect(S(12)).toBe('12')
  })

  it('isoDmy turns dd/mm/yyyy into the ISO date the API takes, or null', () => {
    expect(isoDmy('05/03/2026')).toBe('2026-03-05')
    expect(isoDmy('')).toBeNull()
    expect(isoDmy('31/02/2026')).toBeNull()
  })

  it('isoToDmy turns an API date into dd/mm/yyyy', () => {
    expect(isoToDmy('2026-03-05T00:00:00')).toBe('05/03/2026')
    expect(isoToDmy('2026-03-05')).toBe('05/03/2026')
    expect(isoToDmy(null)).toBe('')
    expect(isoToDmy('')).toBe('')
  })

  it('dispDate keeps desktop text dates and formats API dates', () => {
    expect(dispDate('05/03/2026')).toBe('05/03/2026')
    expect(dispDate('2026-03-05T00:00:00')).toBe('05/03/2026')
    expect(dispDate(null)).toBe('')
  })

  it('codeOf takes the code before " - "', () => {
    expect(codeOf('AC - AXA AFFIN')).toBe('AC')
    expect(codeOf(' AC ')).toBe('AC')
  })

  it('num reads amounts with thousands separators and leaves blanks null', () => {
    expect(num('1,234.50')).toBe(1234.5)
    expect(num('  ')).toBeNull()
    expect(num('abc')).toBe(0)
  })

  it('unTilde turns the desktop line-break marker into a newline', () => expect(unTilde('a~b~c')).toBe('a\nb\nc'))
})
