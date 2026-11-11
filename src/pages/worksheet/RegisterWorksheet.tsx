// Worksheet > Worksheet Registration, the Register tab (legacy frmWorksheetRegGST2015): the next worksheet of a case worked out from its invoices and the patient's plan, the payment details and
// remarks, and the Register button (cmdApprove_Click). The server runs the checks in the desktop's order and asks "Are you sure?"; it writes the whole worksheet in one transaction.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ReadField, SelectField, TextField } from '../../components/Field'
import { ActionBar } from '../../components/Screen'
import { formatDate } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { paymentSchema } from './adjustmentRules'
import type { PaymentValues } from './adjustmentRules'
import { amountText, moneyOrDash } from './enquiryRules'
import { PaymentFields } from './PaymentFields'
import { daysText, summaryRows } from './registrationRules'
import type { CalculationLine, SummaryRow } from './registrationRules'
import { registerValuesOf, savedMessages, toRegisterRequest } from './registerRules'
import type { RegisterForm, RegisterInvoice, RegisterResult } from './registerRules'

const gridColumns: GridColumn<CalculationLine>[] = [
  { key: 'benefit', label: 'Benefits', value: (r) => r.benefit },
  { key: 'limit', label: 'Limit', value: (r) => r.limit ?? '-' },
  { key: 'actual', label: 'Actual', align: 'right', value: (r) => moneyOrDash(r.actual), sortBy: (r) => r.actual },
  { key: 'approved', label: 'Approved', align: 'right', value: (r) => moneyOrDash(r.approved), sortBy: (r) => r.approved },
  { key: 'toHospital', label: 'Payable to Hosp', align: 'right', value: (r) => moneyOrDash(r.toHospital), sortBy: (r) => r.toHospital },
  { key: 'toMember', label: 'Due to/(frm) Mem', align: 'right', value: (r) => moneyOrDash(r.toMember), sortBy: (r) => r.toMember },
]

const invoiceColumns: GridColumn<RegisterInvoice>[] = [
  { key: 'invoiceNo', label: 'Invoice No', value: (r) => r.invoiceNo ?? '' },
  { key: 'invoiceDate', label: 'Invoice Date', value: (r) => formatDate(r.invoiceDate) },
  { key: 'amount', label: 'Amount', align: 'right', value: (r) => moneyOrDash(r.amount), sortBy: (r) => r.amount },
  { key: 'payAmount', label: 'Amount to pay', align: 'right', value: (r) => moneyOrDash(r.payAmount), sortBy: (r) => r.payAmount },
  { key: 'payTo', label: 'Pay To', value: (r) => (r.payTo === 'H' ? 'Hospital' : r.payTo === 'M' ? 'Member' : (r.payTo ?? '')) },
  { key: 'stayType', label: 'Stay', value: (r) => r.stayType ?? '' },
]

const summaryColumns: GridColumn<SummaryRow>[] = [
  { key: 'label', label: 'Summary' },
  { key: 'calculated', label: 'Calculated', align: 'right' },
]

/** What the editor's fields start from changes with the case, the version and the invoices (entering an invoice changes the pay-to and the last document), so the editor starts afresh when one does. */
const editorKey = (form: RegisterForm) => `${form.case.caseNo}-${form.version}-${form.invoices.map((i) => i.index).join(',')}-${form.payTo ?? ''}`

/** The payment fields and the Register button of one loaded case; it is mounted afresh for every case and version so the fields start from the server's defaults. */
function RegisterEditor({ form, onRegistered }: { form: RegisterForm; onRegistered: (result: RegisterResult) => void }) {
  const initial = registerValuesOf(form.defaults)
  const [status, setStatus] = useState(form.defaultStatus)
  const [busy, setBusy] = useState(false)
  const lookups = { banks: form.banks, states: form.states, paymentModes: form.paymentModes }
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentValues>({ resolver: yupResolver(paymentSchema), defaultValues: initial, mode: 'onTouched' })

  async function save(v: PaymentValues) {
    setBusy(true)
    try {
      const url = `/api/worksheet/registration/${encodeURIComponent(form.case.caseNo)}`
      const asked = (await api.post<RegisterResult>(url, toRegisterRequest(status, v, false))).data
      if (asked.confirm && !(await ask(asked.confirm))) return
      const done = asked.saved ? asked : (await api.post<RegisterResult>(url, toRegisterRequest(status, v, true))).data
      savedMessages(done, form.case.caseNo).forEach((m, i) => notify(m, i === 0 ? 'success' : 'info'))
      onRegistered(done)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="screen-form" aria-label="Register worksheet">
      <fieldset>
        <legend>Worksheet</legend>
        <SelectField
          label="Worksheet Status"
          options={form.statuses.map((s) => ({ value: s.code, label: s.text }))}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
      </fieldset>
      <PaymentFields register={register} control={control} errors={errors} lookups={lookups} initial={initial} />
      <ActionBar label="Registration actions">
        <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…" disabled={form.blocked !== null}>
          Register
        </Button>
      </ActionBar>
    </form>
  )
}

/** Registers the next worksheet of a case. */
export function RegisterWorksheet() {
  const queryClient = useQueryClient()
  const [caseNo, setCaseNo] = useState('')
  const [error, setError] = useState('')
  const [cas, setCas] = useState<string | null>(null)
  const [done, setDone] = useState<RegisterResult | null>(null)
  const query = useQuery({
    queryKey: ['worksheet-registration', cas],
    queryFn: async () => (await api.get<RegisterForm>(`/api/worksheet/registration/${encodeURIComponent(cas as string)}`)).data,
    enabled: cas !== null,
    retry: false,
  })
  const form = query.data

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!caseNo.trim()) {
      setError('Please enter Case Number!')
      return
    }
    setError('')
    setDone(null)
    if (caseNo.trim() === cas) void query.refetch()
    setCas(caseNo.trim())
  }

  const registered = (result: RegisterResult) => {
    setDone(result)
    void queryClient.invalidateQueries({ queryKey: ['worksheet-registration'] })
  }

  return (
    <>
      <form onSubmit={submit} noValidate>
        <ActionBar label="Case">
          <TextField
            label="Case No"
            value={caseNo}
            onChange={(e) => setCaseNo(e.target.value)}
            error={error ? { type: 'required', message: error } : undefined}
            autoFocus
          />
          <Button type="submit" disabled={query.isFetching}>
            {query.isFetching ? 'Loading…' : 'Show'}
          </Button>
        </ActionBar>
      </form>

      {cas && query.error && (
        <p role="alert" className="error">
          {errorMessage(query.error)}
        </p>
      )}
      {done && (
        <p role="status" className="muted">
          Worksheet {form?.case.caseNo ?? cas}-{done.version} was registered. Enter the case again to see what is left to register.
        </p>
      )}
      {form && !done && (
        <>
          <div className="registration">
            <fieldset>
              <legend>Case</legend>
              <ReadField label="Case No" value={form.case.caseNo} />
              <ReadField label="Worksheet" value={String(form.version)} hint="the next worksheet of the case" />
              <ReadField label="Member" value={`${form.case.memberNo ?? ''} ${form.case.memberName ?? ''}`.trim()} />
              <ReadField label="Patient" value={`${form.case.patientId ?? ''} ${form.case.patientName ?? ''}`.trim()} />
              <ReadField label="Plan" value={form.case.planCode ?? ''} />
              <ReadField label="Hospital" value={`${form.case.hospitalCode ?? ''} ${form.case.hospitalName ?? ''}`.trim()} />
              <ReadField label="Admitted" value={formatDate(form.case.admissionDate)} />
              <ReadField label="Discharged" value={formatDate(form.case.dischargeDate)} />
              <ReadField label="Room & Board days" value={daysText(form.roomDays)} hint="summed over the invoices" />
              <ReadField label="ICU days" value={daysText(form.icuDays)} hint="summed over the invoices" />
            </fieldset>
          </div>
          {form.blocked && (
            <p role="alert" className="error">
              {form.blocked}
            </p>
          )}
          {form.invoices.length === 0 && (
            <p role="status" className="muted">
              No invoice has been entered for this worksheet. Enter the invoices in Invoice Processing first.
            </p>
          )}
          <DataGrid caption="Invoices" columns={invoiceColumns} rows={form.invoices} rowKey={(r) => String(r.index)} empty="No invoices." />
          {form.notes.map((n) => (
            <p key={n} role="status" className="muted">
              {n}
            </p>
          ))}
          <DataGrid caption="Worksheet" columns={gridColumns} rows={form.lines} rowKey={(r) => String(r.slot)} tall />
          {form.summary && <DataGrid caption="Worksheet summary" columns={summaryColumns} rows={summaryRows(form.summary, null)} rowKey={(r) => r.label} />}
          <p className="muted">Amount due to the member: {amountText(form.dueToMember)}</p>
          <RegisterEditor key={editorKey(form)} form={form} onRegistered={registered} />
        </>
      )}
    </>
  )
}
