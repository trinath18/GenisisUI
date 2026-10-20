// Case > Case Transfer (legacy frmCaseTransferMBMNo, "Case - Transfer of Membership"):
// load a case, review its current member, key in the member/cover to transfer it to.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { Field, ReadField, TextField } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { Button } from '../../components/Button'
import { api, errorMessage } from '../../api/client'
import { ask, notify } from '../../lib/notifyStore'
import { requiredText } from '../../lib/validation'
import { enterRuns, isoToDmy, S } from './caseShared'

interface TransferMemberDto {
  memberNo: string
  coverId: string
  patientName: string | null
  policyNo: string | null
  icNo: string | null
  status: string | null
  effDate: string | null
  expDate: string | null
  coverFound: boolean
}

interface TransferView {
  case: { caseNumber: string; memberNo: string; coverId: string; caseStatus: string | null }
  current: TransferMemberDto | null
}

interface Values {
  caseNo: string
  transferMemberNo: string
  transferCoverId: string
}

const defaults: Values = { caseNo: '', transferMemberNo: '', transferCoverId: '' }

const schema: yup.ObjectSchema<Values> = yup.object({
  caseNo: requiredText('Please enter the Case Number.'),
  transferMemberNo: requiredText('Please enter the Member No. to transfer to.'),
  transferCoverId: requiredText('Please enter the Cover ID to transfer to.'),
})

const policyStatus: Record<string, string> = { A: 'A - Active', C: 'C - Cancelled', D: 'D - Deleted' }

function MemberDetails({ m }: { m: TransferMemberDto | null }) {
  return (
    <>
      <ReadField label="Patient" value={S(m?.patientName)} />
      <ReadField label="Policy No" value={S(m?.policyNo)} />
      <ReadField label="IC No" value={S(m?.icNo)} />
      <ReadField label="Policy Status" value={policyStatus[S(m?.status)] ?? S(m?.status)} />
      <ReadField label="Effective Date" value={isoToDmy(m?.effDate)} />
      <ReadField label="Expiry Date" value={isoToDmy(m?.expDate)} />
    </>
  )
}

export function CaseTransferPage() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<TransferView | null>(null)
  const [target, setTarget] = useState<TransferMemberDto | null>(null)
  const {
    register,
    handleSubmit,
    trigger,
    reset,
    getValues,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  })

  /** CmdGo_Click: the case and the member it is on now. */
  async function load(caseNo = getValues('caseNo'), keepTarget = false) {
    if (!(await trigger('caseNo'))) return
    setBusy(true)
    try {
      const { data } = await api.get<TransferView>(`/api/case/transfer/${encodeURIComponent(caseNo.trim())}`)
      setCurrent(data)
      if (!keepTarget) {
        setTarget(null)
        reset({ caseNo: data.case.caseNumber, transferMemberNo: '', transferCoverId: '' })
      }
      setLoaded(true)
    } catch (e) {
      setLoaded(false)
      setCurrent(null)
      setTarget(null)
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** DisplayTransMBMInfo: shows the member / patient to transfer to once both keys are in. */
  async function lookupTarget() {
    const memberNo = getValues('transferMemberNo').trim()
    const coverId = getValues('transferCoverId').trim()
    setTarget(null)
    if (!loaded || !memberNo || !coverId) return
    try {
      const { data } = await api.get<TransferMemberDto>('/api/case/transfer/member', { params: { memberNo, coverId } })
      setTarget(data)
      if (!data.coverFound) notify('Invalid Cover ID. Please try again.', 'error')
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  function cancel() {
    reset(defaults)
    setLoaded(false)
    setCurrent(null)
    setTarget(null)
  }

  /** cmdSave_Click. */
  const transfer = handleSubmit(async ({ caseNo, transferMemberNo, transferCoverId }) => {
    if (!(await ask(`Transfer case ${caseNo} to member ${transferMemberNo}?`))) return
    setBusy(true)
    try {
      const { data } = await api.post<{ message: string }>(`/api/case/transfer/${encodeURIComponent(caseNo.trim())}`, {
        memberNo: transferMemberNo.trim(),
        coverId: transferCoverId.trim(),
      })
      notify(data.message, 'success')
      setBusy(false)
      await load(caseNo)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  return (
    <PageShell title="Case Transfer" subtitle="Transfer a case to another member (Case – Transfer of Membership).">
      <form onSubmit={transfer} noValidate className="screen-form">
        <fieldset>
          <legend>Case</legend>
          <Field label="Case No" required error={errors.caseNo}>
            <div className="search-inline">
              <input
                maxLength={15}
                autoFocus
                aria-invalid={errors.caseNo ? true : undefined}
                {...register('caseNo', { onChange: () => setLoaded(false) })}
                onKeyDown={enterRuns(load)}
              />
              <Button onClick={() => load()} busy={busy} busyLabel="Loading…">
                Load
              </Button>
            </div>
          </Field>
        </fieldset>

        <div className="card-pair">
          <fieldset>
            <legend>Current Member</legend>
            <ReadField label="Member No" value={S(current?.case.memberNo)} />
            <ReadField label="Cover ID" value={S(current?.case.coverId)} />
            <MemberDetails m={current?.current ?? null} />
          </fieldset>

          <fieldset disabled={!loaded}>
            <legend>Transfer To</legend>
            <TextField label="Member No" required maxLength={30} error={errors.transferMemberNo} {...register('transferMemberNo', { onBlur: lookupTarget })} />
            <TextField label="Cover ID" required maxLength={10} error={errors.transferCoverId} {...register('transferCoverId', { onBlur: lookupTarget })} />
            <MemberDetails m={target} />
          </fieldset>
        </div>

        <ActionBar label="Case transfer actions">
          <Button variant="primary" type="submit" disabled={!loaded || busy}>
            Transfer
          </Button>
          <Button variant="link" onClick={cancel}>
            Cancel
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
