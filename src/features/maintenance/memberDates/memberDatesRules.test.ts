import { describe, expect, it } from 'vitest'
import { memberDatesDefaults, memberDatesFromRow, memberDatesProblem, memberDatesRequest, memberDatesSchema } from './memberDatesRules'
import type { MemberDatesRow, MemberDatesValues } from './memberDatesRules'

const full: MemberDatesValues = {
  effectiveStart: '01/01/1999',
  effectiveEnd: '31/12/2021',
  expiryStart: '31/12/2000',
  expiryEnd: '31/12/2021',
  birthStart: '01/01/1920',
  birthEnd: '31/12/2021',
}

describe('Members Maintenance checks', () => {
  it('asks for the six dates in the desktop order, one message at a time', () => {
    const v = { ...memberDatesDefaults }
    const asked: string[] = []
    for (const key of Object.keys(full) as (keyof MemberDatesValues)[]) {
      asked.push(memberDatesProblem(v)?.message ?? '')
      v[key] = full[key]
    }
    expect(asked).toEqual([
      'Please Enter Effective Start Date',
      'Please Enter Effective End Date',
      'Please Enter Expiry Start Date',
      'Please Enter Expiry End Date',
      'Please Enter DOB Start Date',
      'Please Enter DOB End Date',
    ])
    expect(memberDatesProblem(v)).toBeNull()
  })

  it('refuses a typed date that is not a real day, with the desktop message', async () => {
    await expect(memberDatesSchema.validate({ ...full, expiryEnd: '31/02/2021' })).rejects.toThrow('Invalid Date Format!')
    await expect(memberDatesSchema.validate(full)).resolves.toBeTruthy()
  })
})

describe('Members Maintenance row and request', () => {
  const row: MemberDatesRow = {
    found: true,
    effectiveStart: '1999-01-01T00:00:00',
    effectiveEnd: '2021-12-31T00:00:00',
    expiryStart: '2000-12-31T00:00:00',
    expiryEnd: '2021-12-31T00:00:00',
    birthStart: '1920-01-01T00:00:00',
    birthEnd: '2021-12-31T00:00:00',
    updatedBy: 'LAYHOON',
    updatedOn: '2016-01-15T00:00:00',
  }

  it('shows the saved row as dd/mm/yyyy', () => {
    expect(memberDatesFromRow(row)).toEqual(full)
  })

  it('sends every date as an ISO day', () => {
    expect(memberDatesRequest(full)).toEqual({
      effectiveStart: '1999-01-01',
      effectiveEnd: '2021-12-31',
      expiryStart: '2000-12-31',
      expiryEnd: '2021-12-31',
      birthStart: '1920-01-01',
      birthEnd: '2021-12-31',
    })
  })
})
