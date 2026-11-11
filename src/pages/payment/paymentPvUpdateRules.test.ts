import { describe, expect, it } from 'vitest'
import { editSchema, editValuesOf, lockReason, saveBody, searchDefaults, searchParams, searchSchema } from './paymentPvUpdateRules'
import type { PvDetail, PvRow } from './paymentPvUpdateRules'

const row = (over: Partial<PvRow> = {}): PvRow => ({
  id: 1,
  pvNo: 'CC1',
  pvDate: '2021-08-06T00:00:00',
  caseNo: 'CS1',
  claimVersion: '1',
  paid: 10,
  amount: 10,
  chequeNo: 'MBB1',
  chequeDate: '2021-08-07T00:00:00',
  paymentMode: 'CHEQUE',
  payTo: 'ALI',
  bank: 'MBB',
  account: '123',
  remark: null,
  status: 'A',
  sunNo: null,
  accMonth: '8',
  accYear: '2021',
  ...over,
})
const detail = (source: 'hospital' | 'member', rows: PvRow[] = [row()]): PvDetail => ({ source, pvNo: 'CC1', rows })

describe('pv update rules', () => {
  it('checks the search dates are in order', () => {
    expect(searchSchema.isValidSync({ ...searchDefaults, dateFrom: '02/01/2021', dateTo: '01/01/2021' })).toBe(false)
    expect(searchParams({ ...searchDefaults, source: 'member', pvNo: ' CC1 ', dateFrom: '01/01/2021' })).toEqual({
      source: 'member',
      pvNo: 'CC1',
      caseNo: undefined,
      dateFrom: '2021-01-01',
      dateTo: undefined,
    })
  })

  it('refuses a PV posted to SUN or a stopped member cheque', () => {
    expect(lockReason(detail('member'))).toBeNull()
    expect(lockReason(detail('hospital', [row({ sunNo: 'S1' })]))).toMatch(/SUN/)
    expect(lockReason(detail('member', [row(), row({ status: 'E' })]))).toMatch(/stopped/)
  })

  it('needs a cheque number for a cheque, and writes the date for an online payment', () => {
    const v = editValuesOf(detail('member'))
    expect(v).toMatchObject({ paymentMode: 'CHEQUE', chequeNo: 'MBB1', chequeDate: '07/08/2021', payTo: 'ALI' })
    expect(editSchema.isValidSync(v)).toBe(true)
    expect(editSchema.isValidSync({ ...v, chequeNo: '' })).toBe(false)
    expect(editSchema.isValidSync({ ...v, paymentMode: 'ONLINE', chequeNo: '' })).toBe(true)
    expect(editSchema.isValidSync({ ...v, chequeDate: '' })).toBe(false)
    expect(saveBody(detail('member'), { ...v, paymentMode: 'ONLINE' })).toMatchObject({ chequeNo: '07082021', chequeDate: '2021-08-07', payTo: 'ALI' })
    expect(saveBody(detail('hospital'), v).payTo).toBeUndefined()
  })
})
