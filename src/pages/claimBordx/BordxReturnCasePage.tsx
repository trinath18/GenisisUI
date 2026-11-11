// Claim Bordx > Bor Delivery > Returned Fr Payor (Not App) (legacy FrmReturnPayorCase, "Claim Detail"): look up one worksheet of a bordx that was sent to the payor and set its approved status.
// Leaving the Claim No box looks the worksheet up, as the desktop did.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SelectField, TextField } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { Button } from '../../components/Button'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { returnCaseDay, returnCaseRequest, returnCaseSearchProblem, returnCaseStatusOptions, returnCaseUpdateProblem } from './bordxReturnCaseRules'
import type { ReturnCaseRow } from './bordxReturnCaseRules'

const money = (v: number | null) => (v == null ? '' : formatMoney(v))

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{value || '\u00a0'}</dd>
    </div>
  )
}

export function BordxReturnCasePage() {
  const navigate = useNavigate()
  const [caseNo, setCaseNo] = useState('')
  const [version, setVersion] = useState('1')
  const [versions, setVersions] = useState<string[]>(['1'])
  const [status, setStatus] = useState('N')
  const [row, setRow] = useState<ReturnCaseRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** CmdSearch_Click: a case number, then the worksheet and its bordx. */
  async function find(forVersion = version) {
    const problem = returnCaseSearchProblem(caseNo)
    setError(problem)
    setRow(null)
    if (problem) return
    setBusy(true)
    try {
      const { data } = await api.get<ReturnCaseRow>('/api/claim-bordx/return-case', { params: { caseNo: caseNo.trim(), version: forVersion } })
      setRow(data)
    } catch (ex) {
      notify(errorMessage(ex), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** TxtCaseNo_LostFocus: the versions of the case for the drop-down, then the search. */
  async function leaveCaseNo() {
    if (caseNo.trim() === '') return
    let next = version
    try {
      const { data } = await api.get<number[]>('/api/claim-bordx/return-case/versions', { params: { caseNo: caseNo.trim() } })
      const list = data.map(String)
      setVersions(list.length > 0 ? list : ['1'])
      next = list.includes(version) || list.length === 0 ? version : list[0]
      setVersion(next)
    } catch (ex) {
      notify(errorMessage(ex), 'error')
    }
    await find(next)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void find()
  }

  function clear() {
    setCaseNo('')
    setVersion('1')
    setVersions(['1'])
    setStatus('N')
    setRow(null)
    setError(null)
  }

  /** CmdToPayor_Click: the approved status, "Do you want to update the record?", then the worksheet is looked up again. */
  async function update() {
    const problem = returnCaseUpdateProblem(status, row)
    if (problem) return notify(problem, 'error')
    if (!(await ask('Do you want to update the record?'))) return
    setBusy(true)
    try {
      const { data } = await api.post<{ message: string }>('/api/claim-bordx/return-case', returnCaseRequest(row!, status))
      notify(data.message, 'success')
      setStatus('N')
      await find(String(row!.claimVersion))
    } catch (ex) {
      notify(errorMessage(ex), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell title="Returned From Payor (Not App)" subtitle="Look up a worksheet of a bordx sent to the payor and set its approved status.">
      <form onSubmit={submit} noValidate className="screen-form">
        <fieldset>
          <legend>Claim Detail</legend>
          <TextField
            label="Claim No"
            required
            maxLength={20}
            autoFocus
            value={caseNo}
            onChange={(e) => setCaseNo(e.target.value)}
            onBlur={() => void leaveCaseNo()}
            error={error ? { type: 'required', message: error } : undefined}
          />
          <SelectField
            label="Version"
            options={versions.map((v) => ({ value: v, label: v }))}
            blank={false}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />
          <SelectField label="Approved Status" options={returnCaseStatusOptions} blank={false} value={status} onChange={(e) => setStatus(e.target.value)} />
        </fieldset>

        <fieldset>
          <legend>Worksheet and bordx</legend>
          <dl className="fields">
            <Box label="Payor" value={row?.payor ?? ''} />
            <Box label="Claim No" value={row?.claimNo ?? ''} />
            <Box label="App. Amount" value={money(row?.approvedAmount ?? null)} />
            <Box label="App. Status" value={row?.appStatus ?? ''} />
            <Box label="Bordx No" value={row?.bordxNo ?? ''} />
            <Box label="Bordx Date" value={returnCaseDay(row?.bordxDate ?? null)} />
            <Box label="Bordx Amount" value={money(row?.bordxAmount ?? null)} />
            <Box label="Bordx Status" value={row?.bordxStatus ?? ''} />
          </dl>
        </fieldset>

        <ActionBar label="Returned from payor (not approved) actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="ghost" onClick={() => void update()} disabled={busy}>
            Update
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
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
