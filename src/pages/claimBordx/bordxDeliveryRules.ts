// Claim Bordx > Bor Delivery > Send to Payor and Send to A/C (legacy FrmSendtoPayor and FrmSendtoAC): the form values, the checks the desktop made before searching and updating, and the
// requests. The server repeats the checks. The two screens differ in their criteria (an A/C period for the payor, the date sent to accounts for accounts) and in their list columns.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import { amount, dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy, num, S } from '../case/caseShared'
import { payorCode } from '../worksheet/worksheetRules'

export type DeliveryKind = 'to-payor' | 'to-accounts'

export interface DeliveryRow {
  payor: string | null
  bordxNo: string
  bordxDate: string | null
  amount: number | null
  bordxStatus: string | null
  sent: boolean
  sentOn: string | null
  sentBy: string | null
  toPayorDate: string | null
  fromPayorDate: string | null
  toMnrbDate: string | null
  fromMnrbDate: string | null
  periodMonth: string | null
  periodYear: string | null
}

export interface DeliveryValues {
  useScan: boolean
  payor: string
  bordxFrom: string
  bordxTo: string
  dateFrom: string
  dateTo: string
  amountFrom: string
  amountTo: string
  monthFrom: string
  monthTo: string
  yearFrom: string
  yearTo: string
  sentFrom: string
  sentTo: string
  status: string
  sendDate: string
}

export const deliveryDefaults: DeliveryValues = {
  useScan: true,
  payor: '',
  bordxFrom: '',
  bordxTo: '',
  dateFrom: '',
  dateTo: '',
  amountFrom: '',
  amountTo: '',
  monthFrom: '',
  monthTo: '',
  yearFrom: '',
  yearTo: '',
  sentFrom: '',
  sentTo: '',
  status: '0',
  sendDate: '',
}

/** cboStatus: "0 - Not Sent", "1 - Sent", "2 - Both". */
export const deliveryStatusOptions: Option[] = [
  { value: '0', label: 'Not Sent' },
  { value: '1', label: 'Sent' },
  { value: '2', label: 'Both' },
]

/** What each screen is called and what its step is called in its list. */
export const deliveryScreens: Record<DeliveryKind, { title: string; subtitle: string; statusLabel: string; file: string }> = {
  'to-payor': {
    title: 'Send to Payor',
    subtitle: 'Search bordx, tick the ones sent to their payor and record the date.',
    statusLabel: 'Sent to Payor Status',
    file: 'bordx-send-to-payor.csv',
  },
  'to-accounts': {
    title: 'Send to A/C',
    subtitle: 'Search bordx, tick the ones sent to accounts and record the date.',
    statusLabel: 'Sent to AC Status',
    file: 'bordx-send-to-accounts.csv',
  },
}

export const deliverySchema: yup.ObjectSchema<DeliveryValues> = yup.object({
  useScan: yup.boolean().default(true),
  payor: optionalText(),
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  dateFrom: dmyDate(),
  dateTo: dmyDate(),
  amountFrom: amount(),
  amountTo: amount(),
  monthFrom: optionalText(),
  monthTo: optionalText(),
  yearFrom: optionalText(),
  yearTo: optionalText(),
  sentFrom: dmyDate(),
  sentTo: dmyDate(),
  status: optionalText(),
  sendDate: dmyDate(),
})

const text = (v: string) => v.trim() || undefined

/** The query of the search: only what the screen asks for goes (the period belongs to Send to Payor, the date sent to Send to A/C). */
export const deliveryParams = (kind: DeliveryKind, v: DeliveryValues) => ({
  useScan: v.useScan,
  payor: text(payorCode(v.payor)),
  bordxFrom: text(v.bordxFrom),
  bordxTo: v.useScan ? undefined : text(v.bordxTo),
  dateFrom: isoDmy(v.dateFrom) ?? undefined,
  dateTo: isoDmy(v.dateTo) ?? undefined,
  amountFrom: num(v.amountFrom) ?? undefined,
  amountTo: num(v.amountTo) ?? undefined,
  ...(kind === 'to-payor'
    ? { monthFrom: text(v.monthFrom), monthTo: text(v.monthTo), yearFrom: text(v.yearFrom), yearTo: text(v.yearTo) }
    : { sentFrom: isoDmy(v.sentFrom) ?? undefined, sentTo: isoDmy(v.sentTo) ?? undefined }),
  status: text(v.status),
})

/** CmdSearch_Click's checks for a scan, one message at a time in the desktop's order: the payor, then the bordx number; null when the search may go ahead. */
export const deliverySearchProblem = (v: Pick<DeliveryValues, 'useScan' | 'payor' | 'bordxFrom'>) =>
  !v.useScan
    ? null
    : v.payor.trim() === ''
      ? { field: 'payor' as const, message: 'Please select a Payor' }
      : v.bordxFrom.trim() === ''
        ? { field: 'bordxFrom' as const, message: 'Please Enter Bordx No' }
        : null

/** lstBordxDelivery_ItemCheck: a bordx that was already sent cannot be ticked. */
export const deliveryTickProblem = (r: { sent: boolean }) => (r.sent ? 'Record has been Updated!' : null)

/** BordxNoCheck: scanning a bordx that is already in the list is refused ("Data has been uploaded!"). */
export const isBordxListed = (rows: readonly { bordxNo: string }[], bordxNo: string) => {
  const wanted = bordxNo.trim().toUpperCase()
  return rows.some((r) => r.bordxNo.trim().toUpperCase() === wanted)
}

/** The update button's checks: something ticked, then the date; null when the update may go ahead. */
export const deliveryUpdateProblem = (ticked: number, v: Pick<DeliveryValues, 'sendDate'>) =>
  ticked === 0
    ? { field: null, message: 'Please select at least one record to be updated!' }
    : v.sendDate.trim() === ''
      ? { field: 'sendDate' as const, message: 'Please Enter in date' }
      : null

/** The request of the update: the date as an ISO day and the ticked bordx numbers. */
export const deliveryRequest = (v: Pick<DeliveryValues, 'sendDate'>, ticked: readonly DeliveryRow[]) => ({
  date: isoDmy(v.sendDate),
  bordxNos: ticked.map((r) => r.bordxNo),
})

export const deliveryKey = (r: { bordxNo: string }) => r.bordxNo

/** The A/C period as the list shows it: month/year, or nothing when neither is set. */
export const periodText = (r: Pick<DeliveryRow, 'periodMonth' | 'periodYear'>) =>
  S(r.periodMonth) === '' && S(r.periodYear) === '' ? '' : `${S(r.periodMonth)}/${S(r.periodYear)}`

/** A date column of the list as dd/mm/yyyy. */
export const dayText = (value: string | null) => isoToDmy(value)

/** The step's status as the list shows it. */
export const sentText = (r: Pick<DeliveryRow, 'sent'>) => (r.sent ? 'Sent' : 'Not Sent')
