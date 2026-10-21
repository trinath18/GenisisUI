import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { CodeSelect } from '../../../../components/common/CodeSelect'
import { FormField } from '../../../../components/common/FormField'
import { bordxApi } from '../api/bordxApi'
import { ASCII_VERSIONS, EXPORT_OPTIONS, ExportOption, Messages } from '../constants'
import type { BordxLookups } from '../types'
import { Button } from '../../../../components/Button'

const EMPTY_FORM = { healthCode: '', payorCode: '', version: '', exportOption: '', bordxFrom: '', bordxTo: '', receiptDate: '', batchNo: '', plan: '' }
type AsciiForm = typeof EMPTY_FORM

const orNull = (value: string) => (value === '' ? null : value)

/** Generate ASCII tab (desktop CmdGenerate_Click). The server checks the required fields. */
export function AsciiExportTab({ lookups }: { lookups: BordxLookups }) {
  const [form, setForm] = useState<AsciiForm>(EMPTY_FORM)
  const set = (key: keyof AsciiForm) => (value: string) => setForm((current) => ({ ...current, [key]: value }))
  const generate = useMutation({
    mutationFn: () =>
      bordxApi.exportAscii({
        healthCode: orNull(form.healthCode),
        payorCode: orNull(form.payorCode),
        version: orNull(form.version),
        exportOption: orNull(form.exportOption),
        bordxFrom: orNull(form.bordxFrom),
        bordxTo: orNull(form.bordxTo),
        receiptDate: orNull(form.receiptDate),
        batchNo: form.batchNo === '' ? null : Number(form.batchNo),
        plan: orNull(form.plan),
      }),
  })

  return (
    <div className="registration">
      <fieldset>
        <legend>Generate ASCII</legend>
        <FormField label="Health Plan *">
          <CodeSelect value={form.healthCode} onChange={set('healthCode')} options={lookups.healthCodes} />
        </FormField>
        <FormField label="Payor *">
          <CodeSelect value={form.payorCode} onChange={set('payorCode')} options={lookups.payors} />
        </FormField>
        <FormField label="ASCII Version *">
          <CodeSelect value={form.version} onChange={set('version')} options={ASCII_VERSIONS} />
        </FormField>
        <FormField label="Export Option *">
          <CodeSelect value={form.exportOption} onChange={set('exportOption')} options={EXPORT_OPTIONS} />
        </FormField>
        {form.exportOption === ExportOption.DateRange && (
          <>
            <FormField label="Bordx From *">
              <input type="date" value={form.bordxFrom} onChange={(e) => set('bordxFrom')(e.target.value)} />
            </FormField>
            <FormField label="Bordx To *">
              <input type="date" value={form.bordxTo} onChange={(e) => set('bordxTo')(e.target.value)} />
            </FormField>
            <FormField label="Plan">
              <select value={form.plan} onChange={(e) => set('plan')(e.target.value)}>
                <option value="" />
                {lookups.planFilters.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        )}
        {form.exportOption === ExportOption.Batch && (
          <>
            <FormField label="Receipt Date *">
              <input type="date" value={form.receiptDate} onChange={(e) => set('receiptDate')(e.target.value)} />
            </FormField>
            <FormField label="Batch No *">
              <input type="number" min={1} value={form.batchNo} onChange={(e) => set('batchNo')(e.target.value)} />
            </FormField>
          </>
        )}
        <div className="actions">
          <Button
            variant="primary"
            busy={generate.isPending}
            busyLabel="Generating…"
            disabled={generate.isPending}
            onClick={() => window.confirm(Messages.confirmGenerate) && generate.mutate()}
          >
            Generate
          </Button>
        </div>
      </fieldset>
      {generate.isError && (
        <p className="error" role="alert">
          {errorMessage(generate.error)}
        </p>
      )}
      {generate.data && (
        <p className="success" role="status">
          {Messages.generated} {generate.data.fileName} (principals {generate.data.principals}, supplementaries {generate.data.supplementaries}).
        </p>
      )}
    </div>
  )
}
