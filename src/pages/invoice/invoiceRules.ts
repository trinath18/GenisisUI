// Invoice > Invoice Processing (legacy frmInvoice), read side: the server's types and the small pure rules the page uses to show them.

export interface InvoiceCaseHeader {
  caseNo: string
  memberNo: string | null
  coverId: string | null
  memberName: string | null
  patientName: string | null
  payor: string | null
  planCode: string | null
  insuredType: string | null
  healthType: string | null
  hospitalCode: string | null
  hospital: string | null
  admitted: string | null
  discharged: string | null
  stayType: string | null
  payType: string | null
  claimability: string | null
  lastWorksheetVersion: number | null
}

export interface InvoiceSummary {
  index: number
  invoiceNo: string | null
  invoiceDate: string | null
  payTo: string | null
  payee: string | null
  payeeName: string | null
  amount: number | null
  inWorksheet: boolean
  worksheetVersion: string | null
  bordxNo: string | null
  stayType: string | null
  payType: string | null
  receiptMode: string | null
  receiptDate: string | null
  followUpDate: string | null
  roomType: string | null
  excessAmount: number | null
  payAmount: number | null
  initialAmount: number | null
  uhcNo: string | null
  enteredBy: string | null
  enteredDate: string | null
}

export interface InvoiceCaseResult {
  header: InvoiceCaseHeader
  invoices: InvoiceSummary[]
}

export interface InvoiceRowAmount {
  slot: number
  category: string | null
  benefit: string
  amount: number
}

export interface InvoiceDetail {
  invoice: InvoiceSummary
  rows: InvoiceRowAmount[]
  rowsTotal: number
  rowsMatchAmount: boolean
}

/** Who is paid, as the form's Pay To list says it: H is the hospital, M the member; anything else is shown as it is. */
export function payToText(code: string | null | undefined): string {
  const c = (code ?? '').trim().toUpperCase()
  return c === 'H' ? 'Hospital' : c === 'M' ? 'Member' : c
}

/** The invoice list's worksheet column: whether a worksheet has used the invoice (it cannot be removed then) and which version. */
export function worksheetText(invoice: Pick<InvoiceSummary, 'inWorksheet' | 'worksheetVersion'>): string {
  if (!invoice.inWorksheet) return 'No'
  const version = (invoice.worksheetVersion ?? '').trim()
  return version ? `Yes (version ${version})` : 'Yes'
}

const cents = (v: number | null | undefined) => Math.round((v ?? 0) * 100)

/** The note shown when the rows of an invoice do not add up to the amount saved with it (the invoice was changed after it was saved); empty when they do. */
export function amountNote(detail: Pick<InvoiceDetail, 'rowsTotal' | 'rowsMatchAmount' | 'invoice'>): string {
  if (detail.rowsMatchAmount) return ''
  const money = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `The rows add up to ${money(detail.rowsTotal)} but the invoice amount saved is ${money(detail.invoice.amount ?? 0)}: the invoice was changed after it was saved.`
}

/** The invoices a worksheet has not used yet: the ones Registration will take. */
export const unregistered = (invoices: readonly InvoiceSummary[]): InvoiceSummary[] => invoices.filter((i) => !i.inWorksheet)

/** The invoice amounts added up, to the cent. */
export const invoicesTotal = (invoices: readonly InvoiceSummary[]): number => invoices.reduce((sum, i) => sum + cents(i.amount), 0) / 100
