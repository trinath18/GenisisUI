import { describe, expect, it } from 'vitest'
import {
  deliveryDefaults,
  deliveryParams,
  deliveryRequest,
  deliverySchema,
  deliverySearchProblem,
  deliveryTickProblem,
  deliveryUpdateProblem,
  isBordxListed,
  periodText,
  sentText,
} from './bordxDeliveryRules'
import type { DeliveryRow, DeliveryValues } from './bordxDeliveryRules'

const values = (over: Partial<DeliveryValues> = {}): DeliveryValues => ({ ...deliveryDefaults, ...over })
const row = (over: Partial<DeliveryRow> = {}): DeliveryRow => ({
  payor: 'AB',
  bordxNo: 'NAB0000001',
  bordxDate: '2021-04-01T00:00:00',
  amount: 10,
  bordxStatus: 'C',
  sent: false,
  sentOn: null,
  sentBy: null,
  toPayorDate: null,
  fromPayorDate: null,
  toMnrbDate: null,
  fromMnrbDate: null,
  periodMonth: null,
  periodYear: null,
  ...over,
})

describe('the search form', () => {
  it('starts as the desktop does: scan on, status Not Sent', () => {
    expect(deliveryDefaults.useScan).toBe(true)
    expect(deliveryDefaults.status).toBe('0')
  })

  it('needs a payor and then a bordx number in a scan, one message at a time, and neither in a range', () => {
    expect(deliverySearchProblem(values())).toEqual({ field: 'payor', message: 'Please select a Payor' })
    expect(deliverySearchProblem(values({ payor: 'AB - A PAYOR' }))).toEqual({ field: 'bordxFrom', message: 'Please Enter Bordx No' })
    expect(deliverySearchProblem(values({ payor: 'AB', bordxFrom: 'N1' }))).toBeNull()
    expect(deliverySearchProblem(values({ useScan: false }))).toBeNull()
  })

  it('refuses a date that is not a real dd/mm/yyyy day', async () => {
    await expect(deliverySchema.validate(values({ useScan: false, dateFrom: '31/02/2021' }))).rejects.toThrow('Invalid Date Format!')
  })
})

describe('deliveryParams', () => {
  it('sends the payor code, the ISO days and the numbers, and the range end only outside a scan', () => {
    const v = values({ useScan: false, payor: 'AB - A PAYOR', bordxFrom: ' N1 ', bordxTo: 'N9', dateFrom: '01/04/2021', amountFrom: '10.5' })
    const p = deliveryParams('to-payor', v)
    expect([p.payor, p.bordxFrom, p.bordxTo, p.dateFrom, p.amountFrom, p.status]).toEqual(['AB', 'N1', 'N9', '2021-04-01', 10.5, '0'])
    expect(deliveryParams('to-payor', values({ payor: 'AB', bordxFrom: 'N1', bordxTo: 'N9' })).bordxTo).toBeUndefined()
  })

  it('sends the A/C period for Send to Payor and the date sent for Send to A/C, not both', () => {
    const v = values({ useScan: false, monthFrom: '3', yearTo: '2021', sentFrom: '10/04/2021' })
    const payor: Record<string, unknown> = deliveryParams('to-payor', v)
    expect([payor.monthFrom, payor.yearTo, 'sentFrom' in payor]).toEqual(['3', '2021', false])
    const accounts: Record<string, unknown> = deliveryParams('to-accounts', v)
    expect(['monthFrom' in accounts, accounts.sentFrom]).toEqual([false, '2021-04-10'])
  })
})

describe('ticking and updating', () => {
  it('refuses to tick a bordx that was already sent, with the desktop message', () => {
    expect(deliveryTickProblem(row({ sent: true }))).toBe('Record has been Updated!')
    expect(deliveryTickProblem(row())).toBeNull()
  })

  it('refuses a bordx that is already in the list, trimmed and in any case', () => {
    expect(isBordxListed([row()], ' nab0000001 ')).toBe(true)
    expect(isBordxListed([row()], 'NAB0000002')).toBe(false)
  })

  it('checks something is ticked first and then the date', () => {
    expect(deliveryUpdateProblem(0, { sendDate: '' })).toEqual({ field: null, message: 'Please select at least one record to be updated!' })
    expect(deliveryUpdateProblem(2, { sendDate: ' ' })).toEqual({ field: 'sendDate', message: 'Please Enter in date' })
    expect(deliveryUpdateProblem(2, { sendDate: '05/10/2026' })).toBeNull()
  })

  it('sends the date as an ISO day and the ticked bordx numbers', () => {
    expect(deliveryRequest({ sendDate: '05/10/2026' }, [row(), row({ bordxNo: 'NAB0000002' })])).toEqual({
      date: '2026-10-05',
      bordxNos: ['NAB0000001', 'NAB0000002'],
    })
  })
})

describe('the list', () => {
  it('shows the A/C period as month/year and nothing when neither is set', () => {
    expect(periodText(row())).toBe('')
    expect(periodText(row({ periodMonth: '3', periodYear: '2021' }))).toBe('3/2021')
  })

  it('shows the step as Sent or Not Sent', () => {
    expect([sentText(row()), sentText(row({ sent: true }))]).toEqual(['Not Sent', 'Sent'])
  })
})
