import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ReadField, TextAreaField } from '../../components/Field'
import { Stat } from '../../components/Screen'
import { formatMoney } from '../../lib/format'
import { isoToDmy, S } from '../case/caseShared'
import { amountText, moneyOrDash, notCoveredRows, summaryRows, topupGrid } from './enquiryRules'
import type { EnquiryBenefit, EnquiryDiagnosis, EnquiryHeader, EnquiryInvoice, EnquiryLgRow, EnquiryOthers, EnquiryResult, TopupRow } from './enquiryRules'

const dateColumn = <T,>(key: keyof T & string, label: string, pick: (r: T) => string | null): GridColumn<T> => ({
  key,
  label,
  value: (r) => isoToDmy(pick(r)),
  sortBy: (r) => S(pick(r)),
})
const moneyColumn = <T,>(key: keyof T & string, label: string, pick: (r: T) => number | null, dash = false): GridColumn<T> => ({
  key,
  label,
  align: 'right',
  value: (r) => (dash ? moneyOrDash(pick(r)) : amountText(pick(r))),
  sortBy: (r) => pick(r) ?? 0,
})

// ---------------- Tab 1: Invoices & Diagnosis ----------------

const invoiceColumns: GridColumn<EnquiryInvoice>[] = [
  { key: 'invIndex', label: 'Index', align: 'right' },
  { key: 'bordxed', label: 'Bordx', value: (r) => (r.bordxed ? 'Yes' : '') },
  { key: 'wsDone', label: 'WS', value: (r) => (r.wsDone ? 'Yes' : '') },
  { key: 'wsVersion', label: 'WS No' },
  { key: 'invNo', label: 'Inv No' },
  dateColumn<EnquiryInvoice>('invDate', 'Inv Date', (r) => r.invDate),
  moneyColumn<EnquiryInvoice>('invAmount', 'INV Amount', (r) => r.invAmount),
  { key: 'payTo', label: 'Pay To' },
  { key: 'payee', label: 'Payee' },
  { key: 'claimType', label: 'Claim Type' },
  dateColumn<EnquiryInvoice>('followUpDate', 'Fol. Up Date', (r) => r.followUpDate),
  { key: 'dailyRb', label: 'DailyRB', align: 'right', sortBy: (r) => r.dailyRb ?? 0 },
  moneyColumn<EnquiryInvoice>('rbRate', 'RB Rate', (r) => r.rbRate),
  { key: 'icuDays', label: 'ICUDay', align: 'right', sortBy: (r) => r.icuDays ?? 0 },
  moneyColumn<EnquiryInvoice>('icuRate', 'ICU Rate', (r) => r.icuRate),
  moneyColumn<EnquiryInvoice>('hospitalServices', 'HSS', (r) => r.hospitalServices),
  moneyColumn<EnquiryInvoice>('operatingTheatre', 'OT', (r) => r.operatingTheatre),
  moneyColumn<EnquiryInvoice>('preHospitalService', 'PHService', (r) => r.preHospitalService),
  moneyColumn<EnquiryInvoice>('physicianVisit', 'IHPysVisit', (r) => r.physicianVisit),
  moneyColumn<EnquiryInvoice>('postHospitalTreatment', 'PHTreat', (r) => r.postHospitalTreatment),
]

const diagnosisColumns: GridColumn<EnquiryDiagnosis>[] = [
  { key: 'source', label: 'Diagnosis' },
  { key: 'diagnosis', label: 'Diag Desc' },
  { key: 'onsetDate', label: 'Date On-Set' },
  { key: 'icdCode', label: 'ICD Code' },
]

export function InvoicesTab({ result, disability, icdCodes }: { result: EnquiryResult; disability: string; icdCodes: string }) {
  const h = result.header
  const dates = (pick: (i: EnquiryInvoice) => string | null) =>
    result.invoices
      .map((i) => isoToDmy(pick(i)))
      .filter(Boolean)
      .join(', ')
  return (
    <div className="screen-form">
      <fieldset>
        <legend>Member and case</legend>
        <ReadField label="Mem Name" value={S(h.memberName)} />
        <ReadField label="Patient Name" value={S(h.patientName)} />
        <ReadField label="Hospital" value={S(h.hospital)} />
        <ReadField label="Disability" value={disability} wide />
        <ReadField label="Mem Num" value={S(h.memberNo)} />
        <ReadField label="Pol Num" value={S(h.policyNo)} />
        <ReadField label="Plan Code" value={S(h.planCode)} />
        <ReadField label="Payor" value={[S(h.payor), S(h.payorName)].filter(Boolean).join(' - ')} />
        <ReadField label="GRP Com." value={S(h.groupCompany)} />
        <ReadField label="Eff Date" value={isoToDmy(h.payorEffDate)} />
        <ReadField label="Exp Date" value={isoToDmy(h.payorExpDate)} />
        <ReadField label="ICD Code" value={icdCodes} />
        <ReadField label="DOA" value={isoToDmy(h.admitted)} />
        <ReadField label="DOD" value={isoToDmy(h.discharged)} />
        <ReadField label="Claim Types" value={S(h.payType)} />
        <ReadField label="Fol-up Dates" value={dates((i) => i.followUpDate)} />
        <ReadField label="Pol Status" value={S(h.policyStatus)} />
        <ReadField label="Case Status" value={S(h.caseStatusText)} />
        <ReadField label="Exp Status" value={S(h.expiredStatus)} />
        <ReadField label="Claimability" value={S(h.claimabilityText)} />
      </fieldset>
      <fieldset>
        <legend>Limits and invoices</legend>
        <ReadField
          label="Invoice Num"
          value={result.invoices
            .map((i) => S(i.invNo))
            .filter(Boolean)
            .join(', ')}
        />
        <ReadField label="Invoice Date" value={dates((i) => i.invDate)} />
        <ReadField label="Bal Lmt" value={amountText(h.availableLimit)} hint="Available limit now, without a top-up policy's balance." />
        <ReadField label="Lifetime Lmt" value={amountText(h.lifetimeLimit)} />
        <ReadField label="T/O Lmt" value={amountText(h.takeOverLimit)} />
        <ReadField label="Total Limit Exceeded" value={formatMoney(result.summary.limitExceeded)} />
      </fieldset>
      <DataGrid caption="Invoices" columns={invoiceColumns} rows={result.invoices} rowKey={(r) => String(r.invIndex)} empty="No invoices." />
      <DataGrid caption="Diagnosis" columns={diagnosisColumns} rows={result.diagnoses} rowKey={(r) => `${r.source}-${r.slot}`} empty="No diagnosis." />
    </div>
  )
}

// ---------------- Tab 2: Worksheet ----------------

const benefitColumns: GridColumn<EnquiryBenefit>[] = [
  { key: 'category', label: 'Category' },
  { key: 'benefit', label: 'Benefits' },
  { key: 'days', label: 'Days/Mths', align: 'right' },
  moneyColumn<EnquiryBenefit>('limit', 'Limit', (r) => r.limit, true),
  moneyColumn<EnquiryBenefit>('actual', 'Actual', (r) => r.actual, true),
  moneyColumn<EnquiryBenefit>('approved', 'Approved', (r) => r.approved, true),
  moneyColumn<EnquiryBenefit>('hospital', 'Payable to Hosp', (r) => r.hospital, true),
  moneyColumn<EnquiryBenefit>('member', 'Due to/(frm) Mem', (r) => r.member, true),
]

export function WorksheetTab({ result }: { result: EnquiryResult }) {
  const t = result.totals
  const rows = summaryRows(result.summary, result.header)
  return (
    <div className="screen-form">
      <DataGrid caption="Worksheet" columns={benefitColumns} rows={result.benefits} rowKey={(r) => String(r.slot)} tall empty="No worksheet." />
      <div className="actions" role="group" aria-label="Worksheet totals">
        <Stat label="Total Actual" value={formatMoney(t.actual)} />
        <Stat label="Total Approved" value={formatMoney(t.approved)} />
        <Stat label="Payable to Hosp" value={formatMoney(t.hospital)} />
        <Stat label="Due to/(frm) Mem" value={formatMoney(t.member)} />
      </div>
      <fieldset>
        <legend>Saved with the worksheet</legend>
        {rows.map((r) => (
          <ReadField key={r.label} label={r.label} value={r.value} />
        ))}
      </fieldset>
    </div>
  )
}

// ---------------- Tab 3: Reimbursement Not Cover ----------------

const notCoveredColumns: GridColumn<{ label: string; amount: number }>[] = [
  { key: 'label', label: 'Items' },
  { key: 'amount', label: 'Amount (RM)', align: 'right', value: (r) => moneyOrDash(r.amount), sortBy: (r) => r.amount },
]

export function NotCoveredTab({ invoices }: { invoices: readonly EnquiryInvoice[] }) {
  return (
    <DataGrid
      caption="Reimbursement not covered"
      columns={notCoveredColumns}
      rows={notCoveredRows(invoices)}
      rowKey={(r) => r.label}
      empty="Nothing not covered."
    />
  )
}

// ---------------- Tab 4: Topup ----------------

const topupColumns: GridColumn<TopupRow>[] = [
  { key: 'label', label: 'Membership Topup App Amt' },
  { key: 'ghs4', label: 'GHS4', align: 'right' },
  { key: 'ghs5', label: 'GHS5', align: 'right' },
  { key: 'total', label: 'Total', align: 'right' },
]

export function TopupTab({ header }: { header: EnquiryHeader }) {
  const rows = topupGrid(header)
  return rows ? (
    <DataGrid caption="Topup" columns={topupColumns} rows={rows} rowKey={(r) => r.label} />
  ) : (
    <p className="muted">No top-up amount was approved on this worksheet.</p>
  )
}

// ---------------- Tab 5: Remarks ----------------

export function RemarksTab({ others }: { others: EnquiryOthers | null }) {
  return (
    <fieldset>
      <legend>Remarks</legend>
      <TextAreaField label="Worksheet remarks" readOnly rows={3} wide value={S(others?.worksheetRemarks)} />
      <TextAreaField label="Credit/Debit Note Remarks" readOnly rows={3} wide value={S(others?.creditDebitRemarks)} />
    </fieldset>
  )
}

// ---------------- Tab 6: LG Listing ----------------

export function LgTab({ header, rows }: { header: EnquiryHeader; rows: readonly EnquiryLgRow[] }) {
  const columns: GridColumn<EnquiryLgRow>[] = [
    { key: 'reference', label: 'LG No' },
    dateColumn<EnquiryLgRow>('lgDate', 'LG Date', (r) => r.lgDate),
    moneyColumn<EnquiryLgRow>('lgAmt', 'LG Amt', (r) => r.lgAmt),
    { key: 'patient', label: 'Patient', value: () => S(header.patientName) },
    { key: 'doa', label: 'DOA', value: () => isoToDmy(header.admitted) },
    { key: 'hospital', label: 'Hospital', value: () => S(header.hospital) },
    { key: 'lgIssuedBy', label: 'Issued By' },
    { key: 'lgRemark', label: 'Remark' },
    { key: 'lgUserTime', label: 'User LG Time' },
    { key: 'lgSystemTime', label: 'System LG Time' },
  ]
  return <DataGrid caption="Guarantee letters" columns={columns} rows={[...rows]} rowKey={(r) => String(r.lgNo)} empty="No guarantee letters." />
}

// ---------------- Payment and address panel ----------------

export function PaymentPanel({ header, others, showBordxInd }: { header: EnquiryHeader; others: EnquiryOthers | null; showBordxInd: boolean }) {
  return (
    <fieldset>
      <legend>Payment and address</legend>
      <ReadField label="Pay To" value={S(header.payTo)} />
      <ReadField label="GP" value={S(header.gpName)} />
      <ReadField label="Bank" value={S(header.bank)} />
      <ReadField label="A/C No" value={S(header.accountNo)} />
      <ReadField label="Pymt Mode" value={S(others?.paymentMode)} />
      <ReadField label="Attention" value={S(others?.attention)} />
      <ReadField label="Add 1" value={S(others?.address1)} />
      <ReadField label="Add 2" value={S(others?.address2)} />
      <ReadField label="Add 3" value={S(others?.address3)} />
      <ReadField label="Post Code" value={S(others?.postCode)} />
      <ReadField label="City" value={S(others?.city)} />
      <ReadField label="State" value={S(others?.state)} />
      <ReadField label="Note" value={S(others?.note)} wide />
      {showBordxInd && <ReadField label="Bordx Ind" value={S(header.bordxInd)} />}
      <ReadField label="Link Case" value={S(header.linkCase)} />
      <ReadField label="Ver" value={header.linkVersion == null ? '' : String(header.linkVersion)} />
      <ReadField label="Last Doc." value={isoToDmy(header.lastDocumentDate)} />
      <ReadField label="DN/CR" value={S(header.debitCreditRefNo)} />
    </fieldset>
  )
}
