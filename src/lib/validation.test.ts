import * as yup from 'yup'
import { describe, expect, it } from 'vitest'
import { toCsv } from './exportCsv'
import { amount, dmyDate, hhmmTime, optionalText, requiredDmyDate, requiredText } from './validation'

const error = (schema: { validateSync: (value: unknown) => unknown }, value: unknown) => {
  try {
    schema.validateSync(value)
    return null
  } catch (e) {
    return (e as yup.ValidationError).message
  }
}

describe('validation rules', () => {
  it('requiredText uses the legacy message and trims', () => {
    expect(error(requiredText('Please Enter Case No!'), '   ')).toBe('Please Enter Case No!')
    expect(error(requiredText('Please Enter Case No!'), ' AC1 ')).toBeNull()
  })

  it('optionalText defaults to an empty string', () => expect(optionalText().cast(undefined)).toBe(''))

  it('dmyDate allows empty and rejects anything that is not a real date', () => {
    expect(error(dmyDate(), '')).toBeNull()
    expect(error(dmyDate(), '17/10/2026')).toBeNull()
    expect(error(dmyDate(), '31/02/2026')).toBe('Invalid Date Format!')
    expect(error(dmyDate('Bad'), '1/2/2026')).toBe('Bad')
  })

  it('requiredDmyDate asks first for the date, then checks the format', () => {
    expect(error(requiredDmyDate('Please enter the date.'), '')).toBe('Please enter the date.')
    expect(error(requiredDmyDate('Please enter the date.'), '99/99/9999')).toBe('Invalid Date Format!')
  })

  it('hhmmTime accepts 24-hour times only', () => {
    expect(error(hhmmTime(), '')).toBeNull()
    expect(error(hhmmTime(), '23:59')).toBeNull()
    expect(error(hhmmTime(), '24:00')).toBe('Invalid Time Format!')
    expect(error(hhmmTime(), '9:30')).toBe('Invalid Time Format!')
  })

  it('amount accepts digits with one decimal point', () => {
    expect(error(amount(), '')).toBeNull()
    expect(error(amount(), '1234.50')).toBeNull()
    expect(error(amount(), '12.3.4')).toBe('Enter a valid amount.')
    expect(error(amount(), 'abc')).toBe('Enter a valid amount.')
  })
})

describe('toCsv', () => {
  it('writes a header, quotes cells that need it and keeps empty cells empty', () => {
    const rows = [
      { name: 'ALI, BIN', note: 'said "hi"', amount: 12.5 },
      { name: 'ZAINAB', note: null, amount: undefined },
    ]
    const csv = toCsv(
      [
        { label: 'Name', value: (r) => r.name },
        { label: 'Note', value: (r) => r.note },
        { label: 'Amount', value: (r) => r.amount },
      ],
      rows,
    )
    expect(csv).toBe('Name,Note,Amount\r\n"ALI, BIN","said ""hi""",12.5\r\nZAINAB,,')
  })
})
