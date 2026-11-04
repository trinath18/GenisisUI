// Payment > Enquiry > Payment To Hospital (legacy FrmEnquiryPaymentHospital, "Enquiry Payment to Hospital"): the claims payable to hospitals and what has been paid. Scan a claim number to add it to the list (a code
// that starts with LO opens another screen), or search a range; Print to File writes the list as a CSV.

import { useRef, useState } from 'react'
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
import { formatMoney } from '../../lib/format'
import { downloadCsvRows } from '../../lib/exportCsv'
import { notify } from '../../lib/notifyStore'
import { isScanCode, resolveScanCode } from '../../lib/scanCodes'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import {
  codeOptions,
  fileRows,
  healthTypeOptions,
  paymentColumns,
  paymentOptions,
  scanProblem,
  searchDefaults,
  searchParams,
  searchSchema,
  totalPayable,
  wsStatusOptions,
} from './paymentEnquiryHospitalRules'
import type { Lookups, PaymentRow, SearchResult, SearchValues } from './paymentEnquiryHospitalRules'

const base = '/api/payment/enquiry-hospital'

type Line = PaymentRow & { key: string }

const columns: GridColumn<Line>[] = paymentColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  sortBy: c.sort,
  align: c.right ? 'right' : undefined,
}))

export function PaymentEnquiryHospitalPage() {
  const navigate = useNavigate()
  const lookups = useQuery({
    queryKey: ['payment-enquiry-hospital', 'lookups'],
    queryFn: async () => (await api.get<Lookups>(`${base}/lookups`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const [rows, setRows] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const counter = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const form = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const { register, control, handleSubmit, setValue, reset, formState } = form
  const scan = useWatch({ control, name: 'scan' })

  /** cmdSearch_Click: a scanned claim is added to the list; a range replaces it. */
  async function searchFor(values: SearchValues) {
    if (values.scan && isScanCode(values.caseFrom)) {
      const outcome = resolveScanCode(values.caseFrom)
      setValue('caseFrom', '')
      if (outcome.kind === 'open') return navigate(outcome.route)
      return notify(outcome.kind === 'notMigrated' ? `${outcome.label} has not been migrated yet.` : `Unknown scan code ${outcome.code}.`, 'error')
    }
    const problem = scanProblem(values, rows)
    if (problem) return notify(problem, 'error')
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    try {
      const { data } = await api.get<SearchResult>(base, { params: searchParams(values), signal: abort.signal })
      const lines = data.rows.map((r) => ({ ...r, key: String(counter.current++) }))
      setRows(values.scan ? (prev) => [...prev, ...lines] : lines)
      if (values.scan) setValue('caseFrom', '')
      if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    } catch (e) {
      if (!abort.signal.aborted) notify(errorMessage(e), 'error')
    } finally {
      if (controller.current === abort) setBusy(false)
    }
  }
  const search = (e?: FormEvent) => handleSubmit(searchFor)(e)

  /** cmdStop_Click: abandons the search. */
  function stop() {
    controller.current?.abort()
    setBusy(false)
  }

  /** cmdPrint_Click: the list as a CSV file. */
  function print() {
    if (rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsvRows('payment-to-hospital.csv', fileRows(rows))
  }

  /** cmdClear_Click: the boxes and the list; Use Scan is on again. */
  function clear() {
    reset(searchDefaults)
    setRows([])
  }

  const { errors } = formState
  const l = lookups.data

  return (
    <PageShell title="Enquiry Payment to Hospital" subtitle="Claims payable to hospitals and what has been paid.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search</legend>
          <CheckField label="Use Scan" {...register('scan', { onChange: () => setRows([]) })} />
          {scan ? (
            <TextField label="Clm No" maxLength={30} error={errors.caseFrom} {...register('caseFrom')} />
          ) : (
            <TextRange label="Clm No" from="caseFrom" to="caseTo" register={register} errors={errors} />
          )}
          <ComboField label="Hospital" options={codeOptions(l?.hospitals ?? [])} {...register('hospital')} />
          <ComboField label="Payor" options={codeOptions(l?.payors ?? [])} {...register('payor')} />
          <SelectField label="Health Type" options={healthTypeOptions(l?.healthTypes ?? [])} {...register('healthType')} />
          <SelectField label="WS Claimability" options={wsStatusOptions} {...register('wsStatus')} />
          <SelectField label="Pymt Status" blank={false} options={paymentOptions} {...register('payment')} />
          <TextField label="Inv No" maxLength={100} error={errors.invNo} {...register('invNo')} />
          <CheckField label="Inv No is empty" {...register('blankInvNo')} />
          <DateRange label="Inv Date" from="invDateFrom" to="invDateTo" control={control} register={register} empty="blankInvDate" />
          <TextRange label="PV No" from="pvNoFrom" to="pvNoTo" register={register} errors={errors} empty="blankPvNo" />
          <DateRange label="PV Date" from="pvDateFrom" to="pvDateTo" control={control} register={register} empty="blankPvDate" />
          <TextRange label="SUN PV No" from="sunNoFrom" to="sunNoTo" register={register} errors={errors} empty="blankSunNo" />
          <DateRange label="SUN PV Date" from="sunDateFrom" to="sunDateTo" control={control} register={register} empty="blankSunDate" />
        </fieldset>
        <ActionBar label="Payment to hospital enquiry actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={stop} disabled={!busy}>
            Stop
          </Button>
          <Button variant="ghost" onClick={print} disabled={busy}>
            Print to File
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={rows.length} />
          <Stat label="Pay Hosp Amt" value={formatMoney(totalPayable(rows))} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
        <DataGrid
          caption="Payments to hospitals"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          tall
          empty="No payments. Scan a claim number or enter the criteria and press Search."
        />
      </form>
    </PageShell>
  )
}
