import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { ask } from '../../../../lib/notifyStore'
import { plutoApi } from '../api/plutoApi'
import { ACCEPTED_FILE_TYPES, CONFIRM_UPLOAD_MESSAGE } from '../constants'

/** Membership &gt; Upload Membership Excel (Pluto) (legacy frmMembershipExcelPluto). */
export function PlutoUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation({ mutationFn: (chosen: File) => plutoApi.upload(chosen) })

  async function start() {
    if (file && (await ask(CONFIRM_UPLOAD_MESSAGE))) upload.mutate(file)
  }

  return (
    <section>
      <h2>Upload Membership Excel (Pluto)</h2>
      <div className="registration">
        <fieldset>
          <legend>Workbook</legend>
          <p className="muted">
            First worksheet, headings in row 1, one member per row from row 2 until column A is empty (columns A to AC: No, relationship,
            policy no, name, address 1–3, city, state, postcode, group company, department, branch, sex, renew flag, IC, date of birth, plan,
            insured type, payor eff./exp. dates, exclusion, clinical plan, insured type, eff./exp. dates and exclusion, payor, bordx date).
          </p>
          <FormField label="Excel file *" wide>
            <input type="file" accept={ACCEPTED_FILE_TYPES} disabled={upload.isPending}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); upload.reset() }} />
          </FormField>
          <div className="actions">
            <button type="button" disabled={!file || upload.isPending} onClick={() => void start()}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </fieldset>
      </div>
      {upload.isError && <pre className="error" role="alert">{errorMessage(upload.error)}</pre>}
      {upload.data && <p className="success" role="status">{upload.data.message} ({upload.data.rows} rows)</p>}
    </section>
  )
}
