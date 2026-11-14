// Claim Bordx > Bor Delivery > Bordx Send Date (legacy frmUploadApproval, "Upload Send/Approval/Return"): verify an Excel file, then upload its send dates, the payor's approval codes or the return
// dates. The rules are in bordxSendDateRules.

import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { acceptedFiles, canUpload, confirmText, fileRequired, kindOptions, layoutHint, lineColumns, uploadLabel } from './bordxSendDateRules'
import type { SendDateKind, SendDateLine, SendDateResult } from './bordxSendDateRules'

const base = '/api/claim-bordx/send-date'

function gridColumns(kind: SendDateKind): GridColumn<SendDateLine>[] {
  return lineColumns(kind).map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value }))
}

export function BordxSendDatePage() {
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<SendDateKind>('send')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<SendDateResult | null>(null)
  const [verifiedFile, setVerifiedFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function post(action: 'verify' | 'upload') {
    if (!file) return notify(fileRequired, 'error')
    const data = new FormData()
    data.append('file', file)
    setBusy(true)
    try {
      const { data: answer } = await api.post<SendDateResult>(`${base}/${kind}/${action}`, data, { timeout: 0 })
      setResult(answer)
      setVerifiedFile(action === 'verify' ? file : null)
      notify(answer.message, answer.errors > 0 || answer.rows.length === 0 ? 'error' : 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function upload() {
    if (!canUpload(result, kind, verifiedFile, file)) return notify('Verify the file first.', 'error')
    if (await ask(confirmText)) await post('upload')
  }

  function clear() {
    setFile(null)
    setResult(null)
    setVerifiedFile(null)
    if (input.current) input.current.value = ''
  }

  const shownKind = result?.kind ?? kind
  const rows = result?.rows ?? []

  return (
    <PageShell title="Bordx Send Date" subtitle="Upload the send dates, the payor's approval codes or the return dates of bordx from an Excel file.">
      <form onSubmit={(e) => e.preventDefault()} noValidate className="screen-form">
        <fieldset>
          <legend>Upload Send/Approval/Return</legend>
          <SelectField
            label="Upload"
            blank={false}
            options={kindOptions}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as SendDateKind)
              setResult(null)
              setVerifiedFile(null)
            }}
          />
          <Field label="Excel file" required wide hint={layoutHint[kind]}>
            <input
              ref={input}
              type="file"
              accept={acceptedFiles}
              disabled={busy}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setResult(null)
                setVerifiedFile(null)
              }}
            />
          </Field>
        </fieldset>
        <ActionBar label="Upload actions">
          <Button busy={busy} busyLabel="Verifying…" onClick={() => void post('verify')}>
            Verify
          </Button>
          <Button variant="primary" busy={busy} busyLabel="Uploading…" disabled={!canUpload(result, kind, verifiedFile, file)} onClick={() => void upload()}>
            {uploadLabel[kind]}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              rows.length
                ? downloadCsv(`bordx-${shownKind}-date.csv`, lineColumns(shownKind), rows)
                : notify('Report cannot be printed without any record.', 'info')
            }
          >
            Print to File
          </Button>
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Rows" value={rows.length} />
          <Stat label="Errors" value={result?.errors ?? 0} />
          <Stat label="Uploaded" value={result?.updated ?? 0} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>

      <DataGrid
        caption={result?.updated ? 'Rows uploaded' : 'Rows of the file'}
        columns={gridColumns(shownKind)}
        rows={rows}
        rowKey={(r) => String(r.line)}
        empty="No rows. Choose the upload and the file, then press Verify."
      />
    </PageShell>
  )
}
