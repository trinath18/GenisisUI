import { describe, expect, it } from 'vitest'
import { modeOptions, sourceOptions, statusOptions, trackingColumns, trackingDefaults, trackingParams, trackingSchema } from './paymentTrackingRules'
import type { DetailRow, SummaryRow } from './paymentTrackingRules'

describe('Payment Tracking criteria', () => {
  it('opens on hospital payments listed by claim, with the eight layouts of the procedure', () => {
    expect([trackingDefaults.source, trackingDefaults.mode]).toEqual(['hospital', 'claim'])
    expect(sourceOptions.map((o) => o.value)).toEqual(['hospital', 'member'])
    expect(modeOptions.map((o) => o.value)).toEqual(['claim', 'bordx', 'case', 'hospitalDate', 'member', 'payorDate', 'pv', 'hospital'])
    expect(statusOptions.map((o) => o.value)).toEqual(['F', 'P'])
  })

  it('checks the dates and their order', async () => {
    await expect(trackingSchema.validate({ ...trackingDefaults, dateFrom: '31/02/2021' })).rejects.toThrow('Invalid Date Format!')
    await expect(trackingSchema.validate({ ...trackingDefaults, dateFrom: '02/03/2021', dateTo: '01/03/2021' })).rejects.toThrow(
      'PV Date From cannot be later than PV Date To.',
    )
    await expect(trackingSchema.validate({ ...trackingDefaults, dateFrom: '01/03/2021', dateTo: '01/03/2021' })).resolves.toBeTruthy()
  })

  it('sends trimmed criteria as ISO days, and the debit note range only for member payments', () => {
    const v = { ...trackingDefaults, pvFrom: ' cb1 ', dateFrom: '08/02/2021', debitFrom: 'D1', hospital: '' }
    const h = trackingParams(v)
    expect([h.source, h.mode, h.pvFrom, h.dateFrom, h.hospital]).toEqual(['hospital', 'claim', 'cb1', '2021-02-08', undefined])
    expect('debitFrom' in h).toBe(false)
    expect((trackingParams({ ...v, source: 'member' }) as { debitFrom?: string }).debitFrom).toBe('D1')
  })
})

describe('Payment Tracking columns', () => {
  const row: DetailRow = {
    pvNo: 'CB00105651',
    pvDate: '2021-02-08T00:00:00',
    amount: 140,
    caseNo: 'ST00071091',
    claimVersion: '2',
    memberNo: 'M1',
    memberName: 'ALI',
    hospitalName: 'H1',
    payorCode: 'P1',
    bordxNo: 'B1',
    debitNoteNo: 'D1',
    payTo: 'ALI',
    status: 'F',
    remark: '',
    accMonth: '02',
    accYear: '2021',
  }

  it('lists a hospital payment with its claim and period', () => {
    const c = trackingColumns('hospital', 'claim').detail
    expect(c.map((x) => x.label)).toContain('Amt Paid 2H')
    expect(c.map((x) => x.value(row))).toEqual(['CB00105651', '08/02/2021', '140.00', 'ST00071091-2', 'M1', 'ALI', 'H1', 'P1', 'B1', 'F', '', '02/2021'])
  })

  it('shows the payee and debit note of a member payment', () => {
    const labels = trackingColumns('member', 'claim').detail.map((x) => x.label)
    expect(labels).toEqual(expect.arrayContaining(['Amt Paid 2M', 'Pay To', 'D/N No']))
  })

  it('heads each summary with its key, its date when it has one, the cases and the amount', () => {
    const s: SummaryRow = { key1: 'CB1', keyDate: '2021-02-08T00:00:00', cases: 18, amount: 43760.7 }
    expect(trackingColumns('hospital', 'pv').summary.map((x) => [x.label, x.value(s)])).toEqual([
      ['PV No', 'CB1'],
      ['PV Date', '08/02/2021'],
      ['No of Case', '18'],
      ['Amt Paid 2H', '43,760.70'],
    ])
    expect(trackingColumns('member', 'hospital').summary.map((x) => x.label)).toEqual(['Hospital', 'No of Case', 'Amt Paid 2M'])
  })
})
