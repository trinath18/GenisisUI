// Invoice > Original Invoice Update (legacy frmUpdateInvoice, "Update Invoice"): find the invoice of a case and worksheet version, then record the number, the
// date the original invoice was received (OIR date), the invoice date and the hospital. Go locks the case and version until Clear, as the desktop did.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { DateField, SelectField, TextField } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { Button } from '../../components/Button'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { hospitalEnabled, invoiceLabel, originalDefaults, originalSchema, showProblem, updateProblem, updateRequest, valuesOf } from './invoiceOriginalRules'
import type { OriginalInvoice, OriginalValues } from './invoiceOriginalRules'

interface HospitalOption {
  code: string
  name: string | null
}

export function InvoiceOriginalUpdatePage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<OriginalInvoice[]>([])
  const [picked, setPicked] = useState(0)
  const [busy, setBusy] = useState(false)
  const {
    register,
    reset,
    control,
    getValues,
    setError,
    setFocus,
    clearErrors,
    trigger,
    formState: { errors },
  } = useForm<OriginalValues>({ resolver: yupResolver(originalSchema), defaultValues: originalDefaults, mode: 'onTouched' })
  const hospitals = useQuery({
    queryKey: ['invoice-original-hospitals'],
    queryFn: async () => (await api.get<HospitalOption[]>('/api/invoice/original/hospitals')).data,
    staleTime: Infinity,
  })
  const current = invoices[picked]
  const found = invoices.length > 0

  function show(list: OriginalInvoice[], at: number) {
    setInvoices(list)
    setPicked(at)
    reset(valuesOf(list[at]))
  }

  /** cmdShow_Click / ShowInvoice. */
  async function go() {
    const problem = showProblem(getValues())
    if (problem) {
      setError(problem.field, { message: problem.message })
      notify(problem.message, 'error')
      return setFocus(problem.field)
    }
    clearErrors()
    setBusy(true)
    try {
      const { caseNo, version } = getValues()
      const { data } = await api.get<OriginalInvoice[]>('/api/invoice/original', { params: { case: caseNo.trim(), version: version.trim() } })
      show(data, 0)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** cmdUpdate_Click: the checks, "Are you sure?", the save, then the invoice as it is now. */
  async function update() {
    const v = getValues()
    const problem = updateProblem(v)
    if (problem) {
      setError(problem.field, { message: problem.message })
      notify(problem.message, 'error')
      return setFocus(problem.field)
    }
    if (!(await trigger(['originalDate', 'invoiceDate']))) return
    if (!current || !(await ask('Are you sure?'))) return
    setBusy(true)
    try {
      const { data } = await api.put<{ message: string }>(`/api/invoice/original/${current.id}`, updateRequest(v))
      notify(data.message, 'success')
      const again = (await api.get<OriginalInvoice[]>('/api/invoice/original', { params: { case: current.caseNo, version: current.version } })).data
      show(
        again,
        Math.max(
          0,
          again.findIndex((i) => i.id === current.id),
        ),
      )
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setInvoices([])
    setPicked(0)
    reset(originalDefaults)
    setFocus('caseNo')
  }

  const options = (hospitals.data ?? []).map((h) => ({ value: h.code, label: h.name ?? h.code }))

  return (
    <PageShell title="Original Invoice Update" subtitle="Record the original invoice's number, the date it was received, the invoice date and the hospital.">
      <form onSubmit={(e) => e.preventDefault()} noValidate className="screen-form">
        <fieldset>
          <legend>Update Invoice</legend>
          <TextField label="Case Number" required maxLength={30} autoFocus disabled={found} error={errors.caseNo} {...register('caseNo')} />
          <TextField label="Ver" required maxLength={4} disabled={found} error={errors.version} {...register('version')} />
          {invoices.length > 1 && (
            <SelectField
              label="Invoice"
              blank={false}
              hint={`This version has ${invoices.length} invoices.`}
              value={String(picked)}
              options={invoices.map((i, n) => ({ value: String(n), label: invoiceLabel(i, n + 1) }))}
              onChange={(e) => show(invoices, Number(e.target.value))}
            />
          )}
          <TextField label="Invoice Number" required maxLength={100} disabled={!found} error={errors.invoiceNo} {...register('invoiceNo')} />
          <DateField control={control} name="originalDate" label="OIR Date" required disabled={!found} hint="The date the original invoice was received." />
          <DateField control={control} name="invoiceDate" label="Invoice Date" disabled={!found} hint="Left as it was when empty." />
          <SelectField label="Hospital Name" options={options} disabled={!hospitalEnabled(current)} {...register('hospital')} />
        </fieldset>

        <ActionBar label="Original invoice update actions">
          <Button variant="primary" onClick={go} busy={busy && !found} busyLabel="Working…" disabled={found}>
            Go
          </Button>
          <Button variant="ghost" onClick={update} disabled={!found || busy}>
            Update
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Exit
          </Button>
        </ActionBar>
      </form>
    </PageShell>
  )
}
