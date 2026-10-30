import { describe, expect, it } from 'vitest'
import { healthOptions, modeOptions, sourceOptions, trackingColumns, trackingDefaults, trackingParams, trackingSchema } from './receiptTrackingRules'
import type { DetailRow, SummaryRow } from './receiptTrackingRules'

describe('Receipt Tracking criteria', () => {
  it('opens on member receipts listed by claim, with the desktop choices', () => {
    expect([trackingDefaults.source, trackingDefaults.mode]).toEqual(['member', 'claim'])
    expect(sourceOptions.map((o) => o.label)).toEqual(['Member', 'Payor', 'MNRB'])
    expect(modeOptions.map((o) => o.label)).toEqual(['By Claim', 'By Bordx', 'By Receipt No', 'By Payor'])
    expect(healthOptions.map((o) => o.label)).toEqual(['S - Sihat', 'N - Non-Sihat'])
  })

  it('checks the dates and the amounts', async () => {
    await expect(trackingSchema.validate({ ...trackingDefaults, dateFrom: '31/02/2021' })).rejects.toThrow('Invalid Date Format!')
    await expect(trackingSchema.validate({ ...trackingDefaults, amountFrom: 'abc' })).rejects.toThrow('Amount From is not a number')
    await expect(trackingSchema.validate({ ...trackingDefaults, amountTo: '1,250.50', dateFrom: '01/02/2021' })).resolves.toBeTruthy()
  })

  it('sends every criterion for a claim listing, as ISO days and numbers', () => {
    const p = trackingParams({ ...trackingDefaults, memberNo: ' ab1 ', dateFrom: '01/02/2021', amountFrom: '1,000', acYearFrom: '2021', receiptFrom: ' r1 ' })
    expect([
      p.source,
      p.mode,
      p.memberNo,
      p.dateFrom,
      (p as { amountFrom?: number }).amountFrom,
      (p as { acYearFrom?: string }).acYearFrom,
      p.receiptFrom,
    ]).toEqual(['member', 'claim', 'ab1', '2021-02-01', 1000, '2021', 'r1'])
  })

  it('sends only the criteria a summary uses', () => {
    const p = trackingParams({ ...trackingDefaults, mode: 'bordx', source: 'payor', memberNo: 'ab1', debitFrom: 'D1', bordxFrom: 'B1', healthType: 'S' })
    expect(Object.keys(p).sort()).toEqual(['bordxFrom', 'bordxTo', 'dateFrom', 'dateTo', 'healthType', 'mode', 'payor', 'receiptFrom', 'receiptTo', 'source'])
    expect([p.bordxFrom, p.healthType]).toEqual(['B1', 'S'])
  })
})

describe('Receipt Tracking columns', () => {
  const row = {
    receiptNo: 'R1',
    receiptDate: '2021-02-01T00:00:00',
    amount: 1234.5,
    payorCode: 'AB',
    memberNo: 'M1',
    memberName: 'A MEMBER',
    caseNo: 'AB1',
    claimVersion: 2,
    bordxNo: 'B1',
    debitNoteNo: 'D1',
    remarks: 'x',
    accMonth: '5',
    accYear: '2021',
  } as DetailRow

  it('heads the member detail and the payor and MNRB detail as the desktop did', () => {
    expect(trackingColumns('member', 'claim').detail.map((c) => c.label)).toEqual([
      'Receipt No',
      'Receipt Date',
      'Amount',
      'Payor',
      'Member No',
      'Member Name',
      'Claim No',
      'D/N No',
      'Remarks',
      'A/C Period',
    ])
    expect(trackingColumns('payor', 'claim').detail.map((c) => c.label)).toEqual([
      'Receipt No',
      'Receipt Date',
      "Rec't Amt",
      'Member No',
      'Member Name',
      'Bordx No',
      'WKS No',
      'D/N No',
      'Remarks',
      'A/C Period',
    ])
    expect(trackingColumns('member', 'claim').detail.map((c) => c.value(row))).toEqual([
      'R1',
      '01/02/2021',
      '1,234.50',
      'AB',
      'M1',
      'A MEMBER',
      'AB1-2',
      'D1',
      'x',
      '5/2021',
    ])
    expect(trackingColumns('mnrb', 'claim').detail.map((c) => c.value(row))[5]).toBe('B1')
  })

  it('heads the summaries by what they add and where the money came from', () => {
    expect(trackingColumns('member', 'bordx').summary.map((c) => c.label)).toEqual(['Bordx No', 'Bordx Date', 'No of Case', 'Amt Receipt Fr MBM'])
    expect(trackingColumns('payor', 'receipt').summary.map((c) => c.label)).toEqual(['Receipt No', 'Receipt Date', 'No of Case', 'Amt Receipt Fr Payor'])
    expect(trackingColumns('mnrb', 'payor').summary.map((c) => c.label)).toEqual(['Payor', 'No of Receipt', 'Amt Receipt Fr MNRB'])
    const s = { key1: 'B1', keyDate: '2021-03-01T00:00:00', cases: 3, amount: 50 } as SummaryRow
    expect(trackingColumns('member', 'bordx').summary.map((c) => c.value(s))).toEqual(['B1', '01/03/2021', '3', '50.00'])
  })
})
