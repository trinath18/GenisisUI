// Payment > Others (legacy FrmPaymentOthers; its source is not in the source tree and HISPayment.PaymentOthers has no row, so the screen is rebuilt on the table): a payment voucher to any payee, paid by
// cheque, with the next PV number of the type chosen. The criteria of the list, the fields of a new voucher, and the columns. The server repeats every check.

import * as yup from 'yup'
import type { Option } from '../../components/Field'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { amount, dmyDate, optionalText, requiredDmyDate } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'

export interface OthersRow {
  id: number
  pvNo: string | null
  pvDate: string | null
  payTo: string | null
  amount: number | null
  chequeNo: string | null
  chequeDate: string | null
  payeeBank: string | null
  payeeAccount: string | null
  caseNo: string | null
  remark: string | null
  bankCharges: number | null
  accMonth: string | null
  accYear: string | null
  status: string | null
  updatedBy: string | null
  updatedOn: string | null
}

export interface SearchResult {
  rows: OthersRow[]
  count: number
  totalAmount: number
  truncated: boolean
}

export interface SearchValues {
  pvFrom: string
  pvTo: string
  dateFrom: string
  dateTo: string
  payTo: string
  caseNo: string
}

export interface VoucherValues {
  prefix: 'CB' | 'CC' | 'CG'
  pvDate: string
  payTo: string
  amount: string
  chequeNo: string
  chequeDate: string
  payeeBank: string
  payeeAccount: string
  caseNo: string
  bankCharges: string
  remark: string
}

export const prefixOptions: Option[] = [
  { value: 'CB', label: 'CB' },
  { value: 'CC', label: 'CC' },
  { value: 'CG', label: 'CG' },
]

export const searchDefaults: SearchValues = { pvFrom: '', pvTo: '', dateFrom: '', dateTo: '', payTo: '', caseNo: '' }

export const voucherDefaults = (): VoucherValues => ({
  prefix: 'CB',
  pvDate: isoToDmy(new Date().toISOString()),
  payTo: '',
  amount: '',
  chequeNo: '',
  chequeDate: '',
  payeeBank: '',
  payeeAccount: '',
  caseNo: '',
  bankCharges: '',
  remark: '',
})

export const searchSchema = yup.object({
  pvFrom: optionalText(),
  pvTo: optionalText(),
  dateFrom: dmyDate(),
  dateTo: dmyDate().test('order', 'PV Date From cannot be later than PV Date To.', function (to) {
    const from = isoDmy(this.parent.dateFrom as string)
    const until = isoDmy(to ?? '')
    return !from || !until || from <= until
  }),
  payTo: optionalText(),
  caseNo: optionalText(),
}) as yup.ObjectSchema<SearchValues>

export const voucherSchema = yup.object({
  prefix: yup.mixed<'CB' | 'CC' | 'CG'>().oneOf(['CB', 'CC', 'CG']).required(),
  pvDate: requiredDmyDate('Please enter the PV Date.'),
  payTo: optionalText().required('Please enter the Pay To.').max(120, 'Pay To is too long (120 characters at most).'),
  amount: amount()
    .required('Please enter the Amount.')
    .test('positive', 'Please enter the Amount.', (v) => Number(v) > 0),
  chequeNo: optionalText().required('Please enter the Cheque No.').max(40, 'The Cheque No is too long.'),
  chequeDate: dmyDate(),
  payeeBank: optionalText().max(200, 'The bank is too long (200 characters at most).'),
  payeeAccount: optionalText().max(60, 'The account number is too long (60 characters at most).'),
  caseNo: optionalText().max(30, 'The case number is too long.'),
  bankCharges: amount(),
  remark: optionalText().max(400, 'The remark is too long (400 characters at most).'),
}) as yup.ObjectSchema<VoucherValues>

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

export const searchParams = (v: SearchValues) => ({
  pvFrom: text(v.pvFrom),
  pvTo: text(v.pvTo),
  dateFrom: day(v.dateFrom),
  dateTo: day(v.dateTo),
  payTo: text(v.payTo),
  caseNo: text(v.caseNo),
})

export const voucherBody = (v: VoucherValues) => ({
  prefix: v.prefix,
  pvDate: isoDmy(v.pvDate),
  payTo: v.payTo.trim(),
  amount: Number(v.amount),
  chequeNo: v.chequeNo.trim(),
  chequeDate: day(v.chequeDate),
  payeeBank: text(v.payeeBank),
  payeeAccount: text(v.payeeAccount),
  caseNo: text(v.caseNo),
  bankCharges: v.bankCharges.trim() ? Number(v.bankCharges) : undefined,
  remark: text(v.remark),
})

export const confirmText = (v: VoucherValues) => `Save a ${v.prefix} PV of ${formatMoney(Number(v.amount))} to ${v.payTo.trim()}, cheque ${v.chequeNo.trim()}?`

const m = (v: number | null) => (v == null ? '' : formatMoney(v))

export const othersColumns: (CsvColumn<OthersRow> & { right?: boolean })[] = [
  { label: 'PV No', value: (r) => r.pvNo ?? '' },
  { label: 'PV Date', value: (r) => isoToDmy(r.pvDate) },
  { label: 'Pay To', value: (r) => r.payTo ?? '' },
  { label: 'Amount', value: (r) => m(r.amount), right: true },
  { label: 'Cheque No', value: (r) => r.chequeNo ?? '' },
  { label: 'Cheque Date', value: (r) => isoToDmy(r.chequeDate) },
  { label: 'Bank', value: (r) => r.payeeBank ?? '' },
  { label: 'Account No', value: (r) => r.payeeAccount ?? '' },
  { label: 'Case No', value: (r) => r.caseNo ?? '' },
  { label: 'Bank Charges', value: (r) => m(r.bankCharges), right: true },
  { label: 'A/C Period', value: (r) => (r.accMonth || r.accYear ? `${r.accMonth ?? ''}/${r.accYear ?? ''}` : '') },
  { label: 'Status', value: (r) => r.status ?? '' },
  { label: 'Remark', value: (r) => r.remark ?? '' },
]
