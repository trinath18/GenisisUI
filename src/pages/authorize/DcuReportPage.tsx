// Authorize Claims > DCU Tracking > Claim Report (legacy FrmDCUReport1, "DCU Reports"; the Jupiter form, FrmDCUReport2, is the same form pointed at another server): choose a Claim or Case report, its type and
// selection, narrow it with the selection criteria and Search; the list can be filled, stopped, shown full width (View, Back) and written to a file.

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import { CheckField, ComboField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { api, errorMessage } from '../../api/client'
import { downloadCsvRows } from '../../lib/exportCsv'
import { notify } from '../../lib/notifyStore'
import { DateRange, NumberRange, TextRange } from '../worksheet/RangeFields'
import {
  caseDisabled,
  casePendingOptions,
  caseStatusOptions,
  cashTypeOptions,
  claimPendingOptions,
  claimabilityOptions,
  codeOptions,
  dataStatusOptions,
  defaults,
  fileRows,
  figure,
  healthTypeOptions,
  memberTypeOptions,
  modalityOptions,
  options,
  payorOptions,
  reportName,
  requestOf,
  schema,
  selectionsFor,
  stayTypeOptions,
  supplementaryTypeOptions,
  typesFor,
  withoutCaseCriteria,
} from './dcuReportRules'
import type { Lookups, Mode, ReportResult, Values } from './dcuReportRules'

const base = '/api/authorize/dcu-report'
const modeOptions = [
  { value: 'claim', label: 'Claim' },
  { value: 'case', label: 'Case' },
]

interface Line {
  key: number
  cells: string[]
}

export function DcuReportPage() {
  const navigate = useNavigate()
  const lookups = useQuery({
    queryKey: ['dcu-report', 'lookups'],
    queryFn: async () => (await api.get<Lookups>(`${base}/lookups`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const [result, setResult] = useState<ReportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [listOnly, setListOnly] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const { register, handleSubmit, reset, control, getValues, setValue, formState } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  })
  const [mode, reportType, payor, healthType, loadGroups] = useWatch({
    control,
    name: ['mode', 'reportType', 'payor', 'healthType', 'loadGroups'],
  })
  const types = lookups.data?.reportTypes ?? []
  const selections = selectionsFor(types, mode, Number(reportType))
  const payorCode = payor.split(' - ')[0].trim()
  const groups = useQuery({
    queryKey: ['dcu-report', 'groups', payorCode],
    queryFn: async () => (await api.get<string[]>(`${base}/group-companies`, { params: { payor: payorCode } })).data.map((g) => ({ value: g, label: g })),
    enabled: loadGroups && payorCode.length > 0,
    staleTime: 10 * 60 * 1000,
  })
  const errors = formState.errors

  useEffect(() => () => controller.current?.abort(), [])

  /** cboClaimCase_Click: a Claim or Case report starts at the first report type and selection; a Case report has no bordx or version criteria. */
  function changeMode(next: Mode) {
    setValue('reportType', '0')
    setValue('selection', '0')
    setResult(null)
    if (next === 'case') {
      const cleared = withoutCaseCriteria(getValues())
      for (const name of caseDisabled) setValue(name, cleared[name] as never)
    }
  }

  /** CboReportType_Click: the first selection of the type (none for a type that has none). */
  function changeType(index: number) {
    setValue('selection', selectionsFor(types, getValues('mode'), index).length ? '0' : '')
    setResult(null)
  }

  /** cmdSearch_Click: one request for the whole list; Stop abandons it. */
  async function searchFor(values: Values) {
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setResult(null)
    try {
      const { data } = await api.post<ReportResult>(`${base}/run`, requestOf(values), { signal: abort.signal })
      setResult(data)
      if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    } catch (e) {
      if (!abort.signal.aborted) notify(errorMessage(e), 'error')
    } finally {
      if (controller.current === abort) setBusy(false)
    }
  }
  const search = (e?: FormEvent) => handleSubmit(searchFor)(e)

  /** cmdStop_Click. */
  function stop() {
    controller.current?.abort()
    setBusy(false)
  }

  /** cmdPrint_Click: the list as a CSV file (the desktop exported it to Excel). */
  function print() {
    if (!result || result.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsvRows(
      `dcu-report-${reportName(types, getValues())
        .replace(/[^A-Za-z0-9]+/g, '-')
        .toLowerCase()}.csv`,
      fileRows(result),
    )
  }

  /** cmdClear_Click. */
  function clear() {
    reset(defaults)
    setResult(null)
    setListOnly(false)
  }

  const columns: GridColumn<Line>[] = (result?.columns ?? []).map((c, i) => ({
    key: `c${i}`,
    label: c.header,
    value: (r) => r.cells[i],
    align: c.right ? 'right' : undefined,
    sortBy: (r) => (c.right && !Number.isNaN(figure(r.cells[i])) ? figure(r.cells[i]) : r.cells[i]),
  }))
  const rows: Line[] = (result?.rows ?? []).map((cells, key) => ({ key, cells }))
  const blank = (name: keyof Values, label: string) => <CheckField label={label} {...register(name as never)} />

  return (
    <PageShell title="DCU Reports" subtitle="Claim and case reports by report type and selection.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        {!listOnly && (
          <>
            <fieldset>
              <legend>Claim / Case</legend>
              <SelectField
                label="Claim / Case"
                blank={false}
                options={modeOptions}
                {...register('mode', { onChange: (e: { target: { value: string } }) => changeMode(e.target.value as Mode) })}
              />
              <SelectField
                label="Report Type"
                blank={false}
                options={typesFor(types, mode).map((x) => ({ value: String(x.index), label: x.name }))}
                {...register('reportType', { onChange: (e: { target: { value: string } }) => changeType(Number(e.target.value)) })}
              />
              {selections.length > 0 && (
                <SelectField
                  label="Report Selection"
                  blank={false}
                  options={options(selections)}
                  {...register('selection', { onChange: () => setResult(null) })}
                />
              )}
            </fieldset>

            <fieldset>
              <legend>Selection Criteria</legend>
              <SelectField label="Modality Code" options={modalityOptions} {...register('modality')} />
              <SelectField label="Stay Type" options={stayTypeOptions} {...register('stayType')} />
              <SelectField label="Cash Type" options={cashTypeOptions} {...register('cashType')} />
              <SelectField label="HLT Type" options={healthTypeOptions} {...register('healthType')} />
              {blank('blankHealthType', 'HLT Type is empty')}
              <ComboField label="Payor" options={payorOptions(lookups.data?.payors ?? [], healthType)} {...register('payor')} />
              {blank('blankPayor', 'Payor is empty')}
              <ComboField label="Grp Company" options={groups.data ?? []} {...register('groupCompany')} />
              <CheckField label="List the payor's group companies" {...register('loadGroups')} />
              {blank('blankGroupCompany', 'Grp Company is empty')}
              <SelectField label="INS Type" options={codeOptions(lookups.data?.insTypes ?? [])} {...register('insType')} />
              {blank('blankInsType', 'INS Type is empty')}
              <SelectField label="Mem Type" blank={false} options={memberTypeOptions} {...register('memberType')} />
              <SelectField label="Supp. Type" blank={false} options={supplementaryTypeOptions} {...register('supplementaryType')} />
              <SelectField label="Policy Status" options={codeOptions(lookups.data?.policyStatuses ?? [])} {...register('policyStatus')} />
              {blank('blankPolicyStatus', 'Policy Status is empty')}
              <SelectField label="Data Status" options={dataStatusOptions} {...register('dataStatus')} />
              {blank('blankDataStatus', 'Data Status is empty')}
              <SelectField label="Claimability" options={claimabilityOptions} {...register('claimability')} />
              {blank('blankClaimability', 'Claimability is empty')}
              <SelectField label="Case Status" blank={false} options={caseStatusOptions} {...register('caseStatus')} />
              {blank('blankCaseStatus', 'Case Status is empty')}
              <SelectField label="Case Pending" options={casePendingOptions} {...register('casePending')} />
              <SelectField label="Clm Pending" options={claimPendingOptions} disabled={false} {...register('claimPending')} />
              <TextField label="Agent Code" maxLength={50} {...register('agentCode')} />
              {blank('blankAgentCode', 'Agent Code is empty')}
              <TextField label="Policy No." maxLength={50} {...register('policyNo')} />
              {blank('blankPolicyNo', 'Policy No. is empty')}
              <TextRange label="Plan Code" from="planFrom" to="planTo" register={register} errors={errors} empty="blankPlan" />
              <TextRange label="Final Diag" from="finalDiagFrom" to="finalDiagTo" register={register} errors={errors} empty="blankFinalDiag" />
              <TextRange label="Claim No" from="caseNoFrom" to="caseNoTo" register={register} errors={errors} />
              {mode === 'claim' && (
                <>
                  <TextRange label="Bordx No" from="bordxNoFrom" to="bordxNoTo" register={register} errors={errors} empty="blankBordxNo" />
                  <DateRange label="Bordx Date" from="bordxDateFrom" to="bordxDateTo" control={control} register={register} empty="blankBordxDate" />
                  <NumberRange label="Version" from="versionFrom" to="versionTo" register={register} errors={errors} />
                </>
              )}
              <DateRange label="DOA" from="doaFrom" to="doaTo" control={control} register={register} empty="blankDoa" />
              <DateRange label="DOD" from="dodFrom" to="dodTo" control={control} register={register} empty="blankDod" />
              <DateRange label="DORC" from="dorFrom" to="dorTo" control={control} register={register} empty="blankDor" />
              <DateRange label="Eff Date" from="payorEffFrom" to="payorEffTo" control={control} register={register} empty="blankPayorEff" />
              <DateRange label="Exp Date" from="payorExpFrom" to="payorExpTo" control={control} register={register} empty="blankPayorExp" />
              <DateRange label="Date Join" from="joinFrom" to="joinTo" control={control} register={register} empty="blankJoin" />
            </fieldset>
          </>
        )}

        <ActionBar label="DCU report actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={stop} disabled={!busy}>
            Stop
          </Button>
          {listOnly ? (
            <Button variant="ghost" onClick={() => setListOnly(false)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setListOnly(true)}>
              View
            </Button>
          )}
          <Button variant="ghost" onClick={print} disabled={busy}>
            Print to File
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Record(s)" value={rows.length} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <DataGrid
          caption={result?.title ?? 'DCU Reports'}
          columns={columns}
          rows={rows}
          rowKey={(r) => String(r.key)}
          tall
          empty="No report. Choose a report and press Search."
        />
      </form>
    </PageShell>
  )
}
