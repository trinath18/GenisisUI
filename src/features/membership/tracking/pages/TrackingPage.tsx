import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { CodeSelect } from '../../../../components/common/CodeSelect'
import { FormField } from '../../../../components/common/FormField'
import { trackingApi, trackingKeys } from '../api/trackingApi'
import { TrackingFilters } from '../components/TrackingFilters'
import { TrackingResults } from '../components/TrackingResults'
import { FieldKey, MEMBER_TYPES, META_STALE_MS, MemberType, PRINCIPAL_TYPES, PrincipalType } from '../constants'
import type { RangeValue, TrackingField, TrackingRequest } from '../types'
import { Button } from '../../../../components/Button'

/** Membership &gt; Tracking (legacy FrmNewMBMTracking): choose a report, set filters, Search; Print to File exports every row as CSV. */
export function TrackingPage() {
  const meta = useQuery({ queryKey: trackingKeys.meta, queryFn: trackingApi.getMeta, staleTime: META_STALE_MS })
  const [typeIndex, setTypeIndex] = useState<number | null>(null)
  const [reportKey, setReportKey] = useState('')
  const [memberType, setMemberType] = useState<string>(MemberType.Principal)
  const [principalType, setPrincipalType] = useState<string>(PrincipalType.Both)
  const [values, setValues] = useState<Record<string, string>>({})
  const [ranges, setRanges] = useState<Record<string, RangeValue>>({})
  const [blanks, setBlanks] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const abort = useRef<AbortController | null>(null)

  const request = (): TrackingRequest => ({
    report: reportKey,
    memberType,
    principalType,
    values: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')),
    ranges: Object.fromEntries(Object.entries(ranges).filter(([, r]) => r.from !== '' || r.to !== '')),
    blanks,
  })
  const run = useMutation({
    mutationFn: async () => {
      abort.current = new AbortController()
      try {
        return await trackingApi.run(request(), abort.current.signal)
      } finally {
        abort.current = null
      }
    },
  })
  const exportCsv = useMutation({ mutationFn: () => trackingApi.exportCsv(request()) })

  const reportTypes = useMemo(() => {
    const seen = new Map<number, string>()
    for (const r of meta.data?.reports ?? []) if (!seen.has(r.typeIndex)) seen.set(r.typeIndex, r.type)
    return [...seen.entries()].map(([code, name]) => ({ code: String(code), name }))
  }, [meta.data])
  const groups = useMemo(() => {
    const byGroup = new Map<string, TrackingField[]>()
    for (const f of meta.data?.fields ?? []) byGroup.set(f.group, [...(byGroup.get(f.group) ?? []), f])
    return [...byGroup.entries()]
  }, [meta.data])

  if (meta.isLoading) return <p className="muted">Loading…</p>
  if (meta.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(meta.error)}
      </p>
    )
  const data = meta.data!
  const selections = data.reports.filter((r) => r.typeIndex === typeIndex)
  const report = data.reports.find((r) => r.key === reportKey)

  /** Payors follow the chosen health type, like the desktop's LoadPayor. */
  const optionsFor = (field: TrackingField) => {
    const all = field.options ?? []
    const health = values[FieldKey.Health]
    return field.key === FieldKey.Payor && health ? all.filter((o) => !data.payorHealth[o.code] || data.payorHealth[o.code] === health) : all
  }
  const chooseType = (value: string) => {
    const index = value === '' ? null : Number(value)
    setTypeIndex(index)
    setReportKey(data.reports.find((r) => r.typeIndex === index)?.key ?? '')
    run.reset()
  }
  const clear = () => {
    setValues({})
    setRanges({})
    setBlanks([])
    setMemberType(MemberType.Principal)
    setPrincipalType(PrincipalType.Both)
    run.reset()
  }

  return (
    <section>
      <h2>Membership Tracking</h2>
      <div className="registration">
        <fieldset>
          <legend>Report</legend>
          <FormField label="Report Type *">
            <CodeSelect value={typeIndex === null ? '' : String(typeIndex)} onChange={chooseType} options={reportTypes} />
          </FormField>
          {selections.length > 1 && (
            <FormField label="Report Selection">
              <select
                value={reportKey}
                onChange={(e) => {
                  setReportKey(e.target.value)
                  run.reset()
                }}
              >
                {selections.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.selection}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="MBM Type">
            <CodeSelect value={memberType} onChange={setMemberType} options={MEMBER_TYPES} allowBlank={false} />
          </FormField>
          <FormField label="Principal Type">
            <CodeSelect value={principalType} onChange={setPrincipalType} options={PRINCIPAL_TYPES} allowBlank={false} />
          </FormField>
          <div className="actions">
            <Button variant="ghost" busy={run.isPending} busyLabel="Searching…" disabled={!reportKey || run.isPending} onClick={() => run.mutate()}>
              {' '}
              Search{' '}
            </Button>
            <Button variant="ghost" disabled={!run.isPending} onClick={() => abort.current?.abort()}>
              Stop
            </Button>
            <Button
              variant="ghost"
              busy={exportCsv.isPending}
              busyLabel="Exporting…"
              disabled={!reportKey || exportCsv.isPending}
              onClick={() => exportCsv.mutate()}
            >
              {' '}
              Print to File{' '}
            </Button>
            <Button variant="link" onClick={clear}>
              Clear
            </Button>
            <Button variant="link" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </Button>
          </div>
        </fieldset>
        {showFilters && (
          <TrackingFilters
            groups={groups}
            values={values}
            ranges={ranges}
            blanks={blanks}
            optionsFor={optionsFor}
            onValueChange={(key, value) => setValues((current) => ({ ...current, [key]: value, ...(key === FieldKey.Health ? { [FieldKey.Payor]: '' } : {}) }))}
            onRangeChange={(key, range) => setRanges((current) => ({ ...current, [key]: range }))}
            onBlankChange={(key, blank) => setBlanks((current) => (blank ? [...current, key] : current.filter((k) => k !== key)))}
          />
        )}
      </div>

      {run.isError && (
        <p className="error" role="alert">
          {errorMessage(run.error)}
        </p>
      )}
      {exportCsv.isError && (
        <p className="error" role="alert">
          {errorMessage(exportCsv.error)}
        </p>
      )}
      {run.data && <TrackingResults result={run.data} report={report} />}
    </section>
  )
}
