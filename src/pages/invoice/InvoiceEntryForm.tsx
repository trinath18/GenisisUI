// Invoice > Invoice Processing, write side: the entry form of frmInvoice. Adding and changing an invoice; the server repeats the checks and works every total out.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { api, errorMessage } from '../../api/client'
import { Button } from '../../components/Button'
import { CheckField, DateField, ReadField, SelectField, TextAreaField, TextField } from '../../components/Field'
import { ask, notify } from '../../lib/notifyStore'
import { formatMoney } from '../../lib/format'
import { dmyDate } from '../../lib/validation'
import {
  bySection,
  cleanAmount,
  firstProblem,
  genericProviders,
  isEditable,
  messages,
  needsHospitalConfirmation,
  shown,
  taxEra,
  toRequest,
} from './invoiceEntryRules'
import type { InvoiceCalculation, InvoiceField, InvoiceLookups, InvoiceSaveResult, InvoiceValues } from './invoiceEntryRules'
import type { InvoiceCaseHeader } from './invoiceRules'

const schema = yup.object({
  invoiceNo: yup.string().default(''),
  invoiceDate: dmyDate(messages.badInvoiceDate),
  payTo: yup.string().default(''),
  payee: yup.string().default(''),
  stayType: yup.string().default(''),
  roomType: yup.string().default(''),
  receiptMode: yup.string().default(''),
  receiptDate: dmyDate(),
  followUpDate: dmyDate(),
  excessAmount: yup.string().default(''),
  initialAmount: yup.string().default(''),
  uhcNo: yup.string().default(''),
  amounts: yup.mixed<Record<string, string>>().default({}),
  texts: yup.mixed<Record<string, string>>().default({}),
  remarks: yup.string().default(''),
}) as yup.ObjectSchema<InvoiceValues>

const payToOptions = [
  { value: 'H', label: 'H - Hospital' },
  { value: 'M', label: 'M - Member' },
]

interface Props {
  header: InvoiceCaseHeader
  fields: readonly InvoiceField[]
  lookups: InvoiceLookups
  initial: InvoiceValues
  index: number | null
  onSaved: (index: number) => void
  onCancel: () => void
}

/**
 * The entry form: the invoice's header, then every amount of the invoice by group. A sum is typed only while none of its parts has a value, the totals with tax cannot be typed, and the entries of the
 * plan's tax era and the case's modality are the ones enabled, as in the desktop. The totals come from the server as the amounts are typed.
 */
export function InvoiceEntryForm({ header, fields, lookups, initial, index, onSaved, onCancel }: Props) {
  const [busy, setBusy] = useState(false)
  const [calculation, setCalculation] = useState<InvoiceCalculation | null>(null)
  const form = useForm<InvoiceValues>({ resolver: yupResolver(schema), defaultValues: initial, mode: 'onTouched' })
  const { register, handleSubmit, setValue, watch } = form
  const values = watch()
  const groups = useMemo(() => bySection(fields), [fields])
  const hospitals = useMemo(() => lookups.hospitals.map((h) => ({ value: h.code, label: h.name ?? h.code })), [lookups.hospitals])
  const payeeName = values.payTo === 'H' ? (lookups.hospitals.find((h) => h.code === values.payee)?.name ?? null) : null
  const generic = payeeName !== null && genericProviders.includes(payeeName.trim().toUpperCase())
  const latest = useRef(0)

  // the form's change handlers and getTotal, on the server: the sums, the totals with tax, the invoice amount and the amount to pay
  const watched = JSON.stringify([values.amounts, values.payTo, values.excessAmount])
  useEffect(() => {
    const ticket = ++latest.current
    const timer = setTimeout(async () => {
      try {
        const done = (await api.post<InvoiceCalculation>('/api/invoice/calculate', toRequest(form.getValues(), header.caseNo, index, false))).data
        if (ticket !== latest.current) return
        setCalculation(done)
        const typed = form.getValues().amounts
        for (const f of fields) {
          if (!f.computed && !f.sumOf) continue
          const next = shown(done.amounts[f.key], f.kind)
          if (f.computed || f.sumOf?.some((k) => (typed[k] ?? '').trim() !== '')) {
            if ((typed[f.key] ?? '') !== next) setValue(`amounts.${f.key}`, next)
          }
        }
      } catch {
        // the totals stay as they were; saving reports the problem
      }
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched])

  async function save(v: InvoiceValues) {
    const problem = firstProblem(v, header, payeeName)
    if (problem) return notify(problem, 'error')
    let confirm = false
    if (needsHospitalConfirmation(v, header)) {
      if (!(await ask(messages.differentHospital))) return
      confirm = true
    }
    setBusy(true)
    try {
      let result = (await api.post<InvoiceSaveResult>('/api/invoice', toRequest(v, header.caseNo, index, confirm))).data
      if (result.index === null && result.confirm) {
        if (!(await ask(result.confirm))) return
        result = (await api.post<InvoiceSaveResult>('/api/invoice', toRequest(v, header.caseNo, index, true))).data
      }
      if (result.index === null) return
      if (result.warning) notify(result.warning, 'info')
      notify('Record Save', 'success')
      onSaved(result.index)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function amountField(f: InvoiceField) {
    const name = `amounts.${f.key}` as const
    const r = register(name)
    const editable = isEditable(f, header, values.amounts)
    return (
      <TextField
        key={`${f.key}${f.tax ?? ''}`}
        label={f.label}
        inputMode="decimal"
        disabled={!editable}
        {...r}
        onChange={(e) => {
          e.target.value = cleanAmount(e.target.value)
          return r.onChange(e)
        }}
      />
    )
  }

  function textField(f: InvoiceField) {
    return <TextField key={f.key} label={f.label} wide {...register(`texts.${f.key}`)} />
  }

  function flagField(f: InvoiceField) {
    return (
      <CheckField
        key={f.key}
        label={f.label}
        checked={values.texts[f.key] === 'Y'}
        onChange={(e) => setValue(`texts.${f.key}`, e.target.checked ? 'Y' : 'N', { shouldDirty: true })}
      />
    )
  }

  const field = (f: InvoiceField) => (f.kind === 'Text' ? textField(f) : f.kind === 'Flag' ? flagField(f) : amountField(f))
  const money = (name: 'excessAmount' | 'initialAmount', label: string) => {
    const r = register(name)
    return (
      <TextField
        label={label}
        inputMode="decimal"
        {...r}
        onChange={(e) => {
          e.target.value = cleanAmount(e.target.value)
          return r.onChange(e)
        }}
      />
    )
  }
  const date = (name: 'invoiceDate' | 'receiptDate' | 'followUpDate', label: string) => <DateField control={form.control} name={name} label={label} />

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="registration" aria-label={index === null ? 'New invoice' : 'Change invoice'}>
      <fieldset>
        <legend>{index === null ? 'New invoice' : 'Change invoice'}</legend>
        <SelectField label="Pay To" options={payToOptions} {...register('payTo')} />
        {values.payTo === 'M' ? (
          <TextField label="Payee" {...register('payee')} />
        ) : (
          <SelectField label="Payee Hospital" options={hospitals} {...register('payee')} />
        )}
        {generic && <TextField label="Hospital / Clinic Name" {...register('texts.INVHospName')} />}
        <SelectField
          label="Stay Type"
          options={lookups.stayTypes.map((s) => ({ value: s.code, label: `${s.code} - ${s.name ?? ''}` }))}
          {...register('stayType')}
        />
        <SelectField label="Room Type" options={lookups.roomTypes.map((r) => ({ value: r, label: r }))} {...register('roomType')} />
        <TextField label="Invoice No" {...register('invoiceNo')} />
        {date('invoiceDate', 'Invoice Date')}
        {date('receiptDate', 'Invoice Receipt Date')}
        <SelectField
          label="Invoice Receipt Mode"
          options={lookups.receiptModes.map((m) => ({ value: m.code, label: `${m.code} - ${m.name ?? ''}` }))}
          {...register('receiptMode')}
        />
        {date('followUpDate', 'Follow-up Date')}
        <TextField label="UHC No" {...register('uhcNo')} />
        {money('excessAmount', 'Excess Amount')}
        {money('initialAmount', 'Initial Invoice Amount')}
        <ReadField label="Invoice Amount" value={calculation ? formatMoney(calculation.invoiceAmount) : ''} />
        <ReadField label="Amount to Pay" value={calculation ? formatMoney(calculation.payAmount) : ''} />
        {index === null && <ReadField label="Worksheet Version" value={String(header.nextWorksheetVersion)} hint="The version this invoice will belong to" />}
      </fieldset>

      {groups.map((g) => (
        <fieldset key={g.section}>
          <legend>{g.section}</legend>
          {g.fields.filter((f) => !f.tax || f.tax === taxEra(header.planCode)).map(field)}
        </fieldset>
      ))}

      <TextAreaField label="Remarks (kept once for the case)" wide maxLength={500} {...register('remarks')} />
      <div className="actions">
        <Button type="submit" variant="primary" busy={busy} busyLabel="Saving…">
          Update
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
