import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { CodeSelect } from '../../../../components/common/CodeSelect'
import { FormField } from '../../../../components/common/FormField'
import { saveCsv } from '../../../../lib/download'
import { bordxApi } from '../api/bordxApi'
import { DEFAULT_HEALTH_INDEX, ERRORS_FILE_NAME, FILE_TYPES, FileType, Messages, NO, YES, YES_NO, fileVersion } from '../constants'
import type { BordxError, BordxLookups, BordxUploadOptions } from '../types'
import { UploadResultView, VerifyResultView } from './BordxResults'

const errorsCsv = (errors: BordxError[]) =>
  saveCsv([['Line', 'Policy No', 'Name', 'Error', 'File'], ...errors.map((e) => [e.line, e.policyNo, e.name, e.message, e.fileName])], ERRORS_FILE_NAME)

/** Upload tab: Verify, Upload, Stop and Print (CSV of the error list). */
export function BordxUploadTab({ lookups }: { lookups: BordxLookups }) {
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState('')
  const [payorCode, setPayorCode] = useState('')
  const [healthCode, setHealthCode] = useState(lookups.healthCodes[DEFAULT_HEALTH_INDEX]?.code ?? lookups.healthCodes[0]?.code ?? '')
  const [verifyIc, setVerifyIc] = useState(YES)
  const [labelStatus, setLabelStatus] = useState('')
  const [backToBack, setBackToBack] = useState(NO)
  const abort = useRef<AbortController | null>(null)

  const options = (): BordxUploadOptions => ({
    fileType,
    payorCode,
    healthCode,
    verifyIc: verifyIc === YES,
    labelPrinted: labelStatus === YES,
    backToBack: fileType === FileType.New && backToBack === YES,
  })
  async function withAbort<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    abort.current = new AbortController()
    try {
      return await run(abort.current.signal)
    } finally {
      abort.current = null
    }
  }
  const verify = useMutation({ mutationFn: () => withAbort((signal) => bordxApi.verify(file!, options(), signal)) })
  const upload = useMutation({ mutationFn: () => withAbort((signal) => bordxApi.upload(file!, options(), signal)) })
  const busy = verify.isPending || upload.isPending
  const missing = !file ? Messages.fileRequired : !fileType ? Messages.typeRequired : null
  const resetResults = () => {
    verify.reset()
    upload.reset()
  }

  return (
    <div className="registration">
      <fieldset>
        <legend>Upload</legend>
        <FormField label="File *">
          <input
            type="file"
            accept=".txt,.dat,.asc,text/plain"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              resetResults()
            }}
          />
        </FormField>
        <FormField label="Bordx Type *">
          <CodeSelect
            value={fileType}
            onChange={(v) => {
              setFileType(v)
              resetResults()
            }}
            options={FILE_TYPES}
          />
        </FormField>
        <FormField label="File Version">
          <input value={fileVersion(fileType)} disabled />
        </FormField>
        <FormField label="Payor *">
          <CodeSelect
            value={payorCode}
            onChange={(v) => {
              setPayorCode(v)
              resetResults()
            }}
            options={lookups.payors}
          />
        </FormField>
        <FormField label="Health Type *">
          <CodeSelect value={healthCode} onChange={setHealthCode} options={lookups.healthCodes} />
        </FormField>
        <FormField label="Verify IC">
          <CodeSelect value={verifyIc} onChange={setVerifyIc} options={YES_NO} allowBlank={false} />
        </FormField>
        <FormField label="Label Status">
          <CodeSelect value={labelStatus} onChange={setLabelStatus} options={YES_NO} />
        </FormField>
        <FormField label="Back to Back">
          <CodeSelect value={backToBack} onChange={setBackToBack} options={YES_NO} allowBlank={false} disabled={fileType !== FileType.New} />
        </FormField>
        <p className="muted">
          Standard layout (and the ZURICH / TAK variant). Payors using an AXA layout must still be uploaded from the desktop. Payor can be left blank only for
          ZURICH / TAK files.
        </p>
        <div className="actions">
          <button
            type="button"
            disabled={busy || !!missing}
            title={missing ?? undefined}
            onClick={() => {
              upload.reset()
              verify.mutate()
            }}
          >
            Verify
          </button>
          <button
            type="button"
            disabled={busy || !!missing}
            title={missing ?? undefined}
            onClick={() => {
              if (window.confirm(Messages.confirmUpload)) {
                verify.reset()
                upload.mutate()
              }
            }}
          >
            Upload
          </button>
          <button type="button" disabled={!busy} onClick={() => abort.current?.abort()}>
            Stop
          </button>
          <button type="button" disabled={!verify.data?.errors.length} onClick={() => verify.data && errorsCsv(verify.data.errors)}>
            Print
          </button>
        </div>
      </fieldset>
      {busy && (
        <p className="muted" role="status">
          {verify.isPending ? 'Verifying…' : 'Uploading… (Stop cancels the whole upload; nothing is imported)'}
        </p>
      )}
      {verify.isError && (
        <p className="error" role="alert">
          {errorMessage(verify.error)}
        </p>
      )}
      {upload.isError && (
        <p className="error" role="alert">
          {errorMessage(upload.error)}
        </p>
      )}
      {verify.data && <VerifyResultView result={verify.data} />}
      {upload.data && <UploadResultView result={upload.data} />}
    </div>
  )
}
