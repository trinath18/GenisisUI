import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { ActionBar } from '../../components/Screen'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { AdjustmentDocuments } from './AdjustmentDocuments'
import { isSingleVersion, lastPayTo, paymentProblem, paymentSchema, paymentValuesOf, toUpdateRequest } from './adjustmentRules'
import { PaymentFields } from './PaymentFields'
import type { AdjustmentLookups, PaymentValues } from './adjustmentRules'
import type { EnquiryResult } from './enquiryRules'

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
      <PaymentFields register={register} control={control} errors={errors} lookups={lookups.data} initial={initial} />
      <ActionBar label="Adjustment actions">
        <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…">
          Update
        </Button>
        <AdjustmentDocuments result={result} />
      </ActionBar>
    </form>
  )
}
