import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { formatDate, formatMoney } from '../../../../lib/format'
import { reinstatementApi } from '../api/reinstatementApi'
import { BATCH_NO_MAX_LENGTH, CANCELLED_STATUS, PRINCIPAL_COVER_ID, STILL_ACTIVE_MESSAGE } from '../constants'
import type { ReinstatementRequest, ReinstatementResult, ReinstatementView } from '../types'
import { Button } from '../../../../components/Button'

/** yyyy-mm-dd for input type="date" from an ISO date-time. */
const toInputDate = (value: string | null) => value?.slice(0, 10) ?? ''
const orNull = (value: string) => (value === '' ? null : value)

interface ReinstatementFormProps {
  view: ReinstatementView
  /** Called after a successful reinstatement; the page reloads the membership like the desktop's cmdSearch_Click. */
  onReinstated: (result: ReinstatementResult) => void
}

/**
 * The fields of frmMBMReintstatement for one loaded membership. Rendered with a key per load, so the editable dates start from
 * the stored lapse and expiry dates.
 */
export function ReinstatementForm({ view, onReinstated }: ReinstatementFormProps) {
  const { member, coveredCount } = view
  const [form, setForm] = useState({
    endtBordxDate: '',
    batchNo: '',
    reinstateDate: '',
    lapsedDate: toInputDate(member.lapsedDate),
    expiryDate: toInputDate(member.payorExpiryDate),
  })
  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }))
  const cancelled = member.status?.trim().toUpperCase() === CANCELLED_STATUS

  const reinstate = useMutation({
    mutationFn: () => {
      const body: ReinstatementRequest = {
        endtBordxDate: orNull(form.endtBordxDate),
        batchNo: form.batchNo,
        reinstateDate: orNull(form.reinstateDate),
        lapsedDate: orNull(form.lapsedDate),
        expiryDate: orNull(form.expiryDate),
      }
      return reinstatementApi.reinstate(member.membershipNo, body)
    },
    onSuccess: onReinstated,
  })

  return (
    <div className="registration">
      {!cancelled && <p className="warning">{STILL_ACTIVE_MESSAGE}</p>}
      <fieldset>
        <legend>Membership</legend>
        <FormField label="Name">
          <input value={member.name ?? ''} disabled />
        </FormField>
        <FormField label="Policy No">
          <input value={member.policyNo ?? ''} disabled />
        </FormField>
        <FormField label="Status">
          <input value={member.status ?? ''} disabled />
        </FormField>
        <FormField label="Payor Eff. Date">
          <input value={formatDate(member.payorEffectiveDate)} disabled />
        </FormField>
        <FormField label="Final Expiry Date">
          <input value={formatDate(member.finalExpiryDate)} disabled />
        </FormField>
        <FormField label="Covered Persons">
          <input value={String(coveredCount)} disabled />
        </FormField>
      </fieldset>
      <fieldset>
        <legend>Reinstatement</legend>
        <FormField label="Endt. Bordx Date *">
          <input type="date" value={form.endtBordxDate} disabled={!cancelled} onChange={(e) => set('endtBordxDate')(e.target.value)} />
        </FormField>
        <FormField label="Batch No *">
          <input
            value={form.batchNo}
            inputMode="numeric"
            maxLength={BATCH_NO_MAX_LENGTH}
            disabled={!cancelled}
            onChange={(e) => set('batchNo')(e.target.value.replace(/\D/g, ''))}
          />
        </FormField>
        <FormField label="Reinstatement Date *">
          <input type="date" value={form.reinstateDate} disabled={!cancelled} onChange={(e) => set('reinstateDate')(e.target.value)} />
        </FormField>
        <FormField label="Lapsed Date *">
          <input type="date" value={form.lapsedDate} disabled={!cancelled} onChange={(e) => set('lapsedDate')(e.target.value)} />
        </FormField>
        <FormField label="Expiry Date *">
          <input type="date" value={form.expiryDate} disabled={!cancelled} onChange={(e) => set('expiryDate')(e.target.value)} />
        </FormField>
        <div className="actions">
          <Button
            variant="primary"
            busy={reinstate.isPending}
            busyLabel="Reinstating…"
            disabled={!cancelled || reinstate.isPending}
            onClick={() => reinstate.mutate()}
          >
            {' '}
            Reinstate{' '}
          </Button>
        </div>
      </fieldset>
      {reinstate.isError && (
        <p className="error" role="alert">
          {errorMessage(reinstate.error)}
        </p>
      )}
    </div>
  )
}

/** The fees written to MBMReinstatement by the last reinstatement. */
export function ReinstatementSummary({ result }: { result: ReinstatementResult }) {
  return (
    <div className="registration">
      <p className="success" role="status">
        {result.message}
      </p>
      {result.warnings.map((w) => (
        <p key={w} className="warning">
          {w}
        </p>
      ))}
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Cover</th>
              <th>MCO Fee</th>
              <th>Premium</th>
            </tr>
          </thead>
          <tbody>
            {result.covers.map((c) => (
              <tr key={c.coverId}>
                <td>{c.coverId === PRINCIPAL_COVER_ID ? `${c.coverId} (Principal)` : c.coverId}</td>
                <td>{formatMoney(c.mcoFee)}</td>
                <td>{formatMoney(c.premium)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
