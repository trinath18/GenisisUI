// Shared "generate ASCII file" screen behind Claim ASCII (legacy frmNewClaimAscii) and Case ASCII (legacy frmCaseASCII):
// payor + date range (+ export/worksheet status) -> confirm -> generate. The two VB6 forms differ only in the
// options below, so they are one component.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { ComboField, DateField, ReadField, SelectField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { parseDmy } from '../../lib/masks'
import { api, errorMessage } from '../../api/client'
import { ask, notify } from '../../lib/notifyStore'
import { requiredText } from '../../lib/validation'
import { isoDmy } from './caseShared'
import { useScreenLookups } from './useScreenLookups'

export interface AsciiVariant {
  key: string
  label: string
  /** Caption of the date range for this variant (and the wording of its validation messages). */
  dateLabel: string
  /** Export / worksheet status only apply to some variants. */
  showStatusFields: boolean
}

export interface AsciiExportConfig {
  /** API route under /api/case. */
  endpoint: 'claim-ascii' | 'case-ascii'
  title: string
  subtitle: string
  serverFolder: string
  variants: readonly AsciiVariant[]
  exportStatuses: readonly Option[]
  worksheetStatusLabel: string
  worksheetStatuses: readonly Option[]
  totalLabel?: string
}

interface Values {
  variant: string
  payor: string
  dateFrom: string
  dateTo: string
  exportStatus: string
  worksheetStatus: string
}

interface AsciiResult {
  message: string
  fileName: string
  records: number
  batchNo: string
}

/** Hands a server file to the browser's download. */
function saveBlob(name: string, blob: Blob) {
  // A generic type keeps the desktop's extension-less file name (the browser adds .txt to text/plain downloads).
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/octet-stream' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function buildSchema(config: AsciiExportConfig): yup.ObjectSchema<Values> {
  const variantOf = (key: string) => config.variants.find((v) => v.key === key) ?? config.variants[0]
  const dateRule = (edge: string) =>
    yup
      .string()
      .default('')
      .test('date', function (value) {
        if (!value) return this.createError({ message: `Please enter ${variantOf(this.parent.variant).dateLabel} ${edge}.` })
        return parseDmy(value) ? true : this.createError({ message: 'Invalid Date Format!' })
      })
  const statusRule = (message: string) =>
    yup
      .string()
      .default('')
      .test('status', message, function (value) {
        return !variantOf(this.parent.variant).showStatusFields || !!value
      })
  return yup.object({
    variant: yup.string().required(),
    payor: requiredText('Please enter the Payor code.'),
    dateFrom: dateRule('from'),
    dateTo: dateRule('to'),
    exportStatus: statusRule('Please select the Export status.'),
    worksheetStatus: statusRule(`Please select the ${config.worksheetStatusLabel} status.`),
  })
}

export function AsciiExportForm({ config }: { config: AsciiExportConfig }) {
  const navigate = useNavigate()
  const { payors } = useScreenLookups({ payors: true })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AsciiResult | null>(null)
  const schema = useMemo(() => buildSchema(config), [config])
  const defaults = useMemo<Values>(
    () => ({
      variant: config.variants[0].key,
      payor: '',
      dateFrom: '',
      dateTo: '',
      exportStatus: config.exportStatuses[0].value,
      worksheetStatus: config.worksheetStatuses[0].value,
    }),
    [config],
  )
  const {
    register,
    handleSubmit,
    reset,
    control,
    clearErrors,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  })
  const variantKey = useWatch({ control, name: 'variant' })
  const variant = config.variants.find((v) => v.key === variantKey) ?? config.variants[0]

  async function download(r: AsciiResult) {
    try {
      const { data } = await api.get<Blob>(`/api/case/${config.endpoint}/files/${encodeURIComponent(r.fileName)}`, { responseType: 'blob' })
      saveBlob(r.fileName, data)
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  /** CmdGenerate_Click: the server builds the file, numbers the batch and flags what it exported; the browser then downloads it. */
  const generate = handleSubmit(async (v) => {
    if (!(await ask('Are you sure?'))) return
    setBusy(true)
    setResult(null)
    try {
      const { data } = await api.post<AsciiResult>(`/api/case/${config.endpoint}/generate`, {
        variant: v.variant,
        payor: v.payor,
        dateFrom: isoDmy(v.dateFrom),
        dateTo: isoDmy(v.dateTo),
        exportStatus: variant.showStatusFields ? v.exportStatus : undefined,
        worksheetStatus: variant.showStatusFields ? v.worksheetStatus : undefined,
      })
      setResult(data)
      notify(`${data.message} ${data.fileName} (${data.records} record${data.records === 1 ? '' : 's'})`, 'success')
      await download(data)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  return (
    <PageShell title={config.title} subtitle={config.subtitle}>
      <form onSubmit={generate} noValidate className="screen-form">
        {config.variants.length > 1 && (
          <fieldset>
            <legend>Cases to export</legend>
            <div className="radio-row">
              {config.variants.map((v) => (
                <label key={v.key} className="radio">
                  <input type="radio" value={v.key} {...register('variant', { onChange: () => clearErrors(['dateFrom', 'dateTo']) })} />
                  {v.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend>Export Criteria</legend>
          <ReadField label="Server folder" value={config.serverFolder} hint="The file is created on the server and downloaded by your browser." />
          <ReadField label="Export file name" value={result?.fileName ?? ''} hint="Generated when the export runs." />
          <ComboField label="Payor" required wide options={payors} error={errors.payor} autoFocus {...register('payor')} />
          <DateField control={control} name="dateFrom" label={`${variant.dateLabel} from`} required />
          <DateField control={control} name="dateTo" label={`${variant.dateLabel} to`} required />
          {variant.showStatusFields && (
            <>
              <SelectField label="Export" required options={config.exportStatuses} error={errors.exportStatus} {...register('exportStatus')} />
              <SelectField
                label={config.worksheetStatusLabel}
                required
                options={config.worksheetStatuses}
                error={errors.worksheetStatus}
                {...register('worksheetStatus')}
              />
            </>
          )}
        </fieldset>

        <ActionBar label={`${config.title} actions`}>
          <Button variant="primary" type="submit" busy={busy} busyLabel="Generating…">
            Generate
          </Button>
          <Button variant="ghost" onClick={() => result && download(result)} disabled={!result || busy}>
            Download again
          </Button>
          <Button
            variant="link"
            onClick={() => {
              reset(defaults)
              setResult(null)
            }}
          >
            Clear
          </Button>
          <span className="spacer" />
          {result && <Stat label="Batch No" value={result.batchNo} />}
          <Stat label={config.totalLabel ?? 'Records'} value={result?.records ?? 0} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>
    </PageShell>
  )
}
