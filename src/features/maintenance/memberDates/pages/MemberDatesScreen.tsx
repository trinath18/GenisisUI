// Maintenance > Member (legacy frmMaintenanceMembers, "Members Maintenance", tab "Valid Date Range"): the date ranges a member's effective date, expiry date and date of birth must fall in.

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { DateField } from '../../../../components/Field'
import { ActionBar, PageShell } from '../../../../components/Screen'
import { Button } from '../../../../components/Button'
import { ask, notify } from '../../../../lib/notifyStore'
import { api, errorMessage } from '../../../../api/client'
import { memberDatesDefaults, memberDatesFromRow, memberDatesProblem, memberDatesRequest, memberDatesSchema } from '../memberDatesRules'
import type { MemberDatesRow, MemberDatesValues } from '../memberDatesRules'

export function MemberDatesScreen() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const { control, handleSubmit, reset, setError, setFocus, getValues } = useForm<MemberDatesValues>({
    resolver: yupResolver(memberDatesSchema),
    defaultValues: memberDatesDefaults,
    mode: 'onTouched',
  })

  /** LoadDate: the saved ranges ("Record not found" when the table is empty). */
  useEffect(() => {
    let cancelled = false
    api
      .get<MemberDatesRow>('/api/maintenance/member-dates')
      .then(({ data }) => {
        if (cancelled) return
        if (data.found) reset(memberDatesFromRow(data))
        else notify('Record not found', 'info')
      })
      .catch((e) => notify(errorMessage(e), 'error'))
    return () => {
      cancelled = true
    }
  }, [reset])

  /** cmdUpdate_Click: the dates in the desktop's order, "Do you want to save the record?", then the save. */
  const save = handleSubmit(async (v) => {
    const problem = memberDatesProblem(v)
    if (problem) {
      setError(problem.field, { message: problem.message })
      return setFocus(problem.field)
    }
    if (!(await ask('Do you want to save the record?'))) return
    setBusy(true)
    try {
      const { data } = await api.put<{ message: string }>('/api/maintenance/member-dates', memberDatesRequest(getValues()))
      notify(data.message, 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  return (
    <PageShell title="Members Maintenance" subtitle="Valid Date Range">
      <form onSubmit={(e: FormEvent) => void save(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Effective Date</legend>
          <DateField control={control} name="effectiveStart" label="Start Date" required />
          <DateField control={control} name="effectiveEnd" label="End Date" required />
        </fieldset>
        <fieldset>
          <legend>Expiry Date</legend>
          <DateField control={control} name="expiryStart" label="Start Date" required />
          <DateField control={control} name="expiryEnd" label="End Date" required />
        </fieldset>
        <fieldset>
          <legend>Birth Date</legend>
          <DateField control={control} name="birthStart" label="Start Date" required />
          <DateField control={control} name="birthEnd" label="End Date" required />
        </fieldset>
        <ActionBar label="Members maintenance actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…">
            Update
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>
    </PageShell>
  )
}
