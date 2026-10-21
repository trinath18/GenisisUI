import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { RegistrationPage, type RegistrationInitial } from '../../../../pages/membership/RegistrationPage'
import { tempRegistrationApi, type RenewalDraft } from '../api/tempRegistrationApi'
import { Button } from '../../../../components/Button'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

/** API values to the form's strings: null becomes '', ISO date-times become yyyy-mm-dd for input type="date". */
function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return ISO_DATE.test(value) ? value.slice(0, 10) : value
  return String(value)
}

function toInitial(draft: RenewalDraft): RegistrationInitial {
  const { coveredPersons, ...request } = draft.request
  const form: Record<string, string> = {}
  for (const [key, value] of Object.entries(request)) form[key] = asText(value)
  const covered = coveredPersons.map((person) => Object.fromEntries(Object.entries(person).map(([key, value]) => [key, asText(value)])))
  return { form, covered }
}

/** Membership &gt; Temp MBM Reg (legacy FrmTempMBMReg): register a renewal pre-filled from the previous membership (cmdShow_Click). */
export function TempRegistrationPage() {
  const [number, setNumber] = useState('')
  const load = useMutation({ mutationFn: (previous: string) => tempRegistrationApi.getDraft(previous) })

  return (
    <section>
      <div className="registration">
        <fieldset>
          <legend>Previous Membership</legend>
          <FormField label="Prev Mem No">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && number.trim() && load.mutate(number)}
            />
          </FormField>
          <div className="actions">
            <Button variant="ghost" busy={load.isPending} busyLabel="Loading…" disabled={!number.trim() || load.isPending} onClick={() => load.mutate(number)}>
              Show
            </Button>
          </div>
        </fieldset>
      </div>
      {load.isError && (
        <p className="error" role="alert">
          {errorMessage(load.error)}
        </p>
      )}
      {load.data ? (
        <>
          <p className="muted">
            Renewal of {asText(load.data.request.previousMembershipNo)}: policy year {load.data.policyYear}. Enter the new policy number, payor dates, bordx
            date and batch, then save.
          </p>
          <RegistrationPage
            key={`${asText(load.data.request.previousMembershipNo)}:${load.submittedAt}`}
            initial={toInitial(load.data)}
            title="Temporary Membership Registration"
          />
        </>
      ) : (
        <p className="muted">Enter the previous membership number and press Show to start a renewal registration from it.</p>
      )}
    </section>
  )
}
