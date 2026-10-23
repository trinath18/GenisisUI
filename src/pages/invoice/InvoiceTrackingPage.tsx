// Invoice > Invoice Tracking (legacy FrmInvoiceTracking2): five reports over the invoices (by month, by month and hospital, a general listing, the detail listing and a
// summary by hospital) with the desktop's criteria, each with an "is empty" tick. Print to File downloads the report as a CSV that opens in Excel.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, ComboField, SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import { ActionBar, PageShell, SearchLayout, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, NumberRange, TextRange } from '../worksheet/RangeFields'
import { withKeys } from './invoiceAccountingRules'
import {
  counters,
  csvColumnsOf,
  noRecords,
  noReport,
  payToOptions,
  payTypeOptions,
  payorOf,
  reportColumns,
  reportOptions,
  rowsOf,
  stayTypeOptions,
  trackingDefaults,
  trackingParams,
  trackingSchema,
} from './invoiceTrackingRules'
import type { TrackingResult, TrackingValues } from './invoiceTrackingRules'

const TEN_MINUTES = 10 * 60 * 1000

export function InvoiceTrackingPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState<TrackingResult | null>(null)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    formState: { errors },
  } = useForm<TrackingValues>({ resolver: yupResolver(trackingSchema), defaultValues: trackingDefaults, mode: 'onTouched' })
  const [report, payor] = useWatch({ control, name: ['report', 'payor'] })
  const pair = { register, errors }

  const payors = useQuery({
    queryKey: ['invoice-tracking-payors'],
    queryFn: async () => (await api.get<{ code: string; name: string | null }[]>('/api/invoice/tracking/payors')).data,
    staleTime: TEN_MINUTES,
  })
  const hospitals = useQuery({
    queryKey: ['invoice-tracking-hospitals'],
    queryFn: async () => (await api.get<{ code: string; name: string | null }[]>('/api/invoice/tracking/hospitals')).data,
    staleTime: TEN_MINUTES,
  })
  const payorOptions = (payors.data ?? []).map((p) => {
    const text = p.name ? `${p.code} - ${p.name}` : p.code
    return { value: text, label: text }
  })
  const code = payorOf(payor)
  const known = payorOptions.some((p) => payorOf(p.value) === code)
  const groups = useQuery({
    queryKey: ['invoice-tracking-group-companies', code],
    queryFn: async () => (await api.get<string[]>('/api/invoice/tracking/group-companies', { params: { payor: code } })).data,
    enabled: known,
    staleTime: TEN_MINUTES,
  })

  const shown = result?.report ?? report
  const columns = useMemo(() => reportColumns(shown), [shown])
  const rows = useMemo(() => withKeys(rowsOf(result)), [result])
  const total = counters(result)

  /** CmdSearch_Click / SearchRecord. */
  const search = handleSubmit(
    async (v) => {
      setBusy(true)
      try {
        const { data } = await api.get<TrackingResult>('/api/invoice/tracking/search', { params: trackingParams(v) })
        setResult(data)
        if (rowsOf(data).length === 0) notify('No record found!', 'error')
        else if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
      } catch (e) {
        notify(errorMessage(e), 'error')
      } finally {
        setBusy(false)
      }
    },
    (problems) => notify(problems.report?.message ?? noReport, 'error'),
  )

  /** CmdPrintFile_Click. */
  function exportReport() {
    if (!result || rowsOf(result).length === 0) return notify(noRecords, 'info')
    downloadCsv(`invoice-tracking-${result.report}.csv`, csvColumnsOf(result.report), rowsOf(result))
  }

  function clear() {
    reset(trackingDefaults)
    setResult(null)
  }

  return (
    <PageShell title="Invoice Tracking" subtitle="Track invoices by month, hospital or invoice, with every criterion of the desktop screen.">
      <form onSubmit={search} noValidate className="screen-form">
        <SearchLayout
          panel={
            <>
              <div className="ct-pair">
                <TextRange label="Inv No" from="invoiceNoFrom" to="invoiceNoTo" empty="invoiceNoEmpty" maxLength={100} {...pair} />
              </div>
              <div className="ct-pair">
                <NumberRange label="Version" from="versionFrom" to="versionTo" empty="versionEmpty" {...pair} />
              </div>
              <SelectField label="Stay Type" options={stayTypeOptions} {...register('stayType')} />
              <SelectField label="Pay Type" options={payTypeOptions} {...register('payType')} />
              <SelectField label="Pay To" options={payToOptions} {...register('payTo')} />
              <CheckField label="Pay To is empty" {...register('payToEmpty')} />
              <div className="ct-pair">
                <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" empty="bordxEmpty" maxLength={40} {...pair} />
              </div>
              <div className="ct-pair">
                <DateRange label="Inv Reg" from="registeredFrom" to="registeredTo" empty="registeredEmpty" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <NumberRange label="Inv Amt" from="amountFrom" to="amountTo" empty="amountEmpty" {...pair} />
              </div>
              <div className="ct-pair">
                <DateRange label="DOA" from="doaFrom" to="doaTo" empty="doaEmpty" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange label="DOD" from="dodFrom" to="dodTo" empty="dodEmpty" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange label="Bordx Date" from="bordxDateFrom" to="bordxDateTo" empty="bordxDateEmpty" control={control} register={register} />
              </div>
            </>
          }
        >
          <fieldset>
            <legend>Selection Criteria</legend>
            <SelectField
              label="Rpt Selection"
              required
              options={reportOptions}
              error={errors.report}
              {...register('report', { onChange: () => setResult(null) })}
            />
            <ComboField label="Payor" options={payorOptions} {...register('payor')} />
            <CheckField label="Payor is empty" {...register('payorEmpty')} />
            <SelectField
              label="Hospital"
              options={(hospitals.data ?? []).map((h) => ({ value: h.code, label: h.name ?? h.code }))}
              {...register('hospitalCode')}
            />
            <ComboField label="Grp Company" options={(groups.data ?? []).map((g) => ({ value: g, label: g }))} maxLength={300} {...register('groupCompany')} />
            <CheckField label="Grp Company is empty" {...register('groupCompanyEmpty')} />
            <div className="ct-pair ws-span2">
              <TextRange label="WS No" from="worksheetFrom" to="worksheetTo" empty="worksheetEmpty" maxLength={30} {...pair} />
            </div>
            <div className="ct-pair ws-span2">
              <DateRange label="Inv Date" from="invoiceDateFrom" to="invoiceDateTo" empty="invoiceDateEmpty" control={control} register={register} />
            </div>
          </fieldset>

          <ActionBar label="Invoice tracking actions">
            <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
              Search
            </Button>
            <Button variant="ghost" onClick={exportReport}>
              Print to File
            </Button>
            <Button variant="link" onClick={clear}>
              Clear
            </Button>
            <span className="spacer" />
            <Stat label="Record(s)" value={total.cases} />
            <Stat label="of" value={total.rows} />
            <Stat label="Total Amt" value={formatMoney(total.amount)} />
            <Button variant="link" onClick={() => navigate('/')}>
              Exit
            </Button>
          </ActionBar>

          <DataGrid
            caption="Invoice tracking"
            columns={columns.grid}
            rows={rows}
            rowKey={(r) => r.key}
            tall
            empty={getValues('report') || shown ? 'No rows. Enter the search criteria and press Search.' : 'Select a report and press Search.'}
          />
        </SearchLayout>
      </form>
    </PageShell>
  )
}
