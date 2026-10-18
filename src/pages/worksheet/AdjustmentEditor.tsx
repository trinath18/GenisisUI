import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { DateField, SelectField, TextAreaField, TextField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { ActionBar } from '../../components/Screen'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { AdjustmentDocuments } from './AdjustmentDocuments'
import { isSingleVersion, lastPayTo, limits, paymentProblem, paymentSchema, paymentValuesOf, toUpdateRequest } from './adjustmentRules'
import type { AdjustmentLookups, PaymentValues } from './adjustmentRules'
import type { EnquiryResult } from './enquiryRules'

/** The list as options; a saved value the list no longer has stays selectable so opening a worksheet never changes it. */
const options = (list: readonly string[], current: string): Option[] =>
  [...new Set([...list, ...(current ? [current] : [])])].map((x) => ({ value: x, label: x }))

/**
 * Worksheet Adjustment's Update button (cmdUpdate_Click): the payment details, the member's address, the note and the remarks of the version on show. The grid itself is
 * read-only here. The server repeats the checks and saves everything in one transaction.
 */
export function AdjustmentEditor({ result, onSaved }: { result: EnquiryResult; onSaved: () => void }) {
  const version = result.selectedVersion
  const [busy, setBusy] = useState(false)
  const lookups = useQuery({
    queryKey: ['worksheet-adjustment-lookups'],
    queryFn: async () => (await api.get<AdjustmentLookups>('/api/worksheet/adjustment/lookups')).data,
    staleTime: Infinity,
  })
  const initial = paymentValuesOf(result)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentValues>({ resolver: yupResolver(paymentSchema), defaultValues: initial, mode: 'onTouched' })

  if (!isSingleVersion(version)) {
    return <p className="muted">Choose one worksheet version (not Master or an M version) to change its payment details.</p>
  }

  async function save(v: PaymentValues) {
    const problem = paymentProblem(lastPayTo(result.invoices), v)
    if (problem) return notify(problem, 'error')
    if (!(await ask('Are you sure?'))) return
    setBusy(true)
    try {
      await api.put(`/api/worksheet/adjustment/${encodeURIComponent(result.header.caseNo)}/${version}/payment`, toUpdateRequest(v))
      notify('Record Save', 'success')
      onSaved()
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="screen-form" aria-label="Payment details and remarks">
      <fieldset>
        <legend>Payment details</legend>
        <TextField label="Pay To" maxLength={limits.payTo} error={errors.payTo} {...register('payTo')} />
        <TextField label="GP" maxLength={limits.gpName} error={errors.gpName} {...register('gpName')} />
        <SelectField label="Bank" options={options(lookups.data?.banks ?? [], initial.bank)} error={errors.bank} {...register('bank')} />
        <TextField label="A/C No" maxLength={limits.accountNo} error={errors.accountNo} {...register('accountNo')} />
        <SelectField
          label="Pymt Mode"
          options={options(lookups.data?.paymentModes ?? ['BY POST', 'BANK-IN'], initial.paymentMode)}
          error={errors.paymentMode}
          {...register('paymentMode')}
        />
        <TextField label="Attention" maxLength={limits.attention} error={errors.attention} {...register('attention')} />
        <DateField control={control} name="lastDocumentDate" label="Last Doc." />
      </fieldset>
      <fieldset>
        <legend>Member&apos;s address</legend>
        <TextField label="Add 1" maxLength={limits.address1} error={errors.address1} {...register('address1')} />
        <TextField label="Add 2" maxLength={limits.address2} error={errors.address2} {...register('address2')} />
        <TextField label="Add 3" maxLength={limits.address3} error={errors.address3} {...register('address3')} />
        <TextField label="Post Code" maxLength={limits.postCode} error={errors.postCode} {...register('postCode')} />
        <TextField label="City" maxLength={limits.city} error={errors.city} {...register('city')} />
        <SelectField label="State" options={options(lookups.data?.states ?? [], initial.state)} error={errors.state} {...register('state')} />
      </fieldset>
      <fieldset>
        <legend>Note and remarks</legend>
        <TextField label="Note" wide maxLength={limits.note} error={errors.note} {...register('note')} />
        <TextAreaField
          label="Worksheet remarks"
          wide
          rows={3}
          maxLength={limits.worksheetRemarks}
          error={errors.worksheetRemarks}
          {...register('worksheetRemarks')}
        />
        <TextAreaField
          label="Credit/Debit Note Remarks"
          wide
          rows={3}
          maxLength={limits.creditDebitNoteRemarks}
          error={errors.creditDebitNoteRemarks}
          {...register('creditDebitNoteRemarks')}
        />
      </fieldset>
      <ActionBar label="Adjustment actions">
        <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…">
          Update
        </Button>
        <AdjustmentDocuments result={result} />
      </ActionBar>
    </form>
  )
}
