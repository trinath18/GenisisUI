import { describe, expect, it } from 'vitest'
import { digitsOnly, maskDate, maskTime, parseDmy } from './masks'

describe('maskDate (MaskEdBox ##/##/####)', () => {
  it.each([
    ['1', '1'],
    ['170', '17/0'],
    ['17102026', '17/10/2026'],
    ['17/10/2026', '17/10/2026'],
    ['171020261234', '17/10/2026'],
    ['ab1c2', '12'],
  ])('%s -> %s', (raw, masked) => expect(maskDate(raw)).toBe(masked))
})

describe('parseDmy', () => {
  it('reads a real date', () => expect(parseDmy('29/02/2024')?.toDateString()).toBe(new Date(2024, 1, 29).toDateString()))
  it.each(['', '31/04/2024', '29/02/2023', '1/1/2024', '2024-01-01', '32/01/2024'])('rejects %j', (text) => expect(parseDmy(text)).toBeNull())
})

describe('maskTime (MaskEdBox ##:##)', () => {
  it.each([
    ['1', '1'],
    ['143', '14:3'],
    ['1430', '14:30'],
    ['14:30', '14:30'],
    ['14309', '14:30'],
  ])('%s -> %s', (raw, masked) => expect(maskTime(raw)).toBe(masked))
})

describe('digitsOnly (KeyNumber)', () => {
  it.each([
    ['12a.5', '12.5'],
    ['1.2.3', '1.23'],
    ['abc', ''],
    ['100', '100'],
    ['.5', '.5'],
  ])('%s -> %s', (raw, clean) => expect(digitsOnly(raw)).toBe(clean))
})
