// Claim Bordx > Bor Delivery > Send to Payor and Send to A/C (legacy FrmSendtoPayor and FrmSendtoAC, "Bordx Delivery" and "Bordx Sent to A/C"): search bordx, tick the ones that were
// handed over and record the date. One page serves both screens; they differ in their criteria and list columns (bordxDeliveryRules.ts).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, ComboField, DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, SearchLayout, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, NumberRange, TextRange } from '../worksheet/RangeFields'
import { useTickList } from '../worksheet/useTickList'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import type { SearchResult } from '../worksheet/worksheetRules'
import {
  deliveryDefaults,
  deliveryKey,
  deliveryParams,
  deliveryRequest,
  deliveryScreens,
  deliverySchema,
  deliverySearchProblem,
  deliveryStatusOptions,
  deliveryTickProblem,
  deliveryUpdateProblem,
  dayText,
  isBordxListed,
  periodText,
  sentText,
} from './bordxDeliveryRules'
import type { DeliveryKind, DeliveryRow, DeliveryValues } from './bordxDeliveryRules'

const money = (r: DeliveryRow) => (r.amount == null ? '' : formatMoney(r.amount))

const common = (statusLabel: string): GridColumn<DeliveryRow>[] => [
  { key: 'payor', label: 'Payor' },
  { key: 'bordxNo', label: 'Bordx No' },
  { key: 'bordxDate', label: 'Bordx Date', value: (r) => dayText(r.bordxDate), sortBy: (r) => r.bordxDate ?? '' },
  { key: 'amount', label: 'Bordx Amount', align: 'right', value: money, sortBy: (r) => r.amount ?? 0 },
  { key: 'bordxStatus', label: 'Bordx Status' },
  { key: 'sent', label: statusLabel, value: sentText },
]

const columnsOf = (kind: DeliveryKind): GridColumn<DeliveryRow>[] => {
  const statusLabel = deliveryScreens[kind].statusLabel
  const date = (key: keyof DeliveryRow, label: string): GridColumn<DeliveryRow> => ({
    key,
    label,
    value: (r) => dayText(r[key] as string | null),
    sortBy: (r) => String(r[key] ?? ''),
  })
  return kind === 'to-payor'
    ? [...common(statusLabel), date('sentOn', 'To Payor'), { key: 'sentBy', label: 'Sent By' }, { key: 'period', label: 'A/C Period', value: periodText }]
    : [
        ...common(statusLabel).slice(0, 5),
        date('toPayorDate', 'To Payor'),
        date('fromPayorDate', 'Fr Payor'),
        date('toMnrbDate', 'To MNRB'),
        date('fromMnrbDate', 'Fr MNRB'),
        date('sentOn', 'To A/C'),
        common(statusLabel)[5],
        { key: 'sentBy', label: 'Sent By' },
        { key: 'period', label: 'A/C Period', value: periodText },
      ]
}

const exportColumnsOf = (kind: DeliveryKind): CsvColumn<DeliveryRow>[] =>
  columnsOf(kind).map((c) => ({
    label: c.label,
    value: (r) => (c.value ? c.value(r) : (r[c.key as keyof DeliveryRow] as string | number | boolean | null)?.toString()),
  }))

async function load(kind: DeliveryKind, v: DeliveryValues) {
  return (await api.get<SearchResult<DeliveryRow>>(`/api/claim-bordx/delivery/${kind}/search`, { params: deliveryParams(kind, v) })).data
}

/** The Send to Payor or Send to A/C screen. */
export function BordxDeliveryPage({ kind }: { kind: DeliveryKind }) {
  const screen = deliveryScreens[kind]
  const navigate = useNavigate()
  const list = useTickList<DeliveryRow>(deliveryKey, deliveryTickProblem)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    setFocus,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<DeliveryValues>({ resolver: yupResolver(deliverySchema), defaultValues: deliveryDefaults, mode: 'onTouched' })
  const [useScan, payor] = useWatch({ control, name: ['useScan', 'payor'] })
  const lookups = useWorksheetLookups(payor)
  const total = list.rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const pair = { register, errors }

  /** CmdSearch_Click. A scan adds the bordx to the list; a range replaces it. */
  const search = handleSubmit(async (v) => {
    const problem = deliverySearchProblem(v)
    if (problem) {
      setError(problem.field, { message: problem.message })
      return setFocus(problem.field)
    }
    if (v.useScan && isBordxListed(list.rows, v.bordxFrom)) return notify('Data has been uploaded!', 'error')
    setBusy(true)
    try {
      const found = await load(kind, v)
      if (found.rows.length === 0) notify('No record found!', 'error')
      else if (v.useScan) list.append(found.rows)
      else list.replace(found.rows)
      if (found.truncated) notify('Only the first 5,000 bordx are shown. Narrow the search to see the rest.', 'info')
      if (v.useScan) {
        setValue('bordxFrom', '')
        setFocus('bordxFrom')
      }
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  function clear() {
    reset(deliveryDefaults)
    list.clear()
  }

  /** CmdToPayor_Click / CmdToAC_Click: something ticked, the date, "Do you want to update the record?"; the server refuses a bordx that was already sent. */
  async function send() {
    const problem = deliveryUpdateProblem(list.ticked.length, getValues())
    if (problem?.field) {
      setError(problem.field, { message: problem.message })
      return setFocus(problem.field)
    }
    if (problem) return notify(problem.message, 'error')
    if (!(await trigger('sendDate'))) return setFocus('sendDate')
    if (!(await ask('Do you want to update the record?'))) return
    setBusy(true)
    try {
      const v = getValues()
      const { data } = await api.post<{ message: string }>(`/api/claim-bordx/delivery/${kind}/send`, deliveryRequest(v, list.ticked))
      notify(data.message, 'success')
      list.clear()
      if (!v.useScan) list.replace((await load(kind, v)).rows)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportList() {
    if (list.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv(screen.file, exportColumnsOf(kind), list.rows)
  }

  return (
    <PageShell title={screen.title} subtitle={screen.subtitle}>
      <form onSubmit={search} noValidate className="screen-form">
        <SearchLayout
          panel={
            <>
              <div className="ct-pair">
                <DateRange label="Bordx Date" from="dateFrom" to="dateTo" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <NumberRange label="Bordx Amt" from="amountFrom" to="amountTo" {...pair} />
              </div>
              {kind === 'to-payor' ? (
                <>
                  <div className="ct-pair">
                    <TextRange label="A/C Month" from="monthFrom" to="monthTo" maxLength={2} {...pair} />
                  </div>
                  <div className="ct-pair">
                    <TextRange label="A/C Year" from="yearFrom" to="yearTo" maxLength={4} {...pair} />
                  </div>
                </>
              ) : (
                <div className="ct-pair">
                  <DateRange label="Date Sent" from="sentFrom" to="sentTo" control={control} register={register} />
                </div>
              )}
            </>
          }
        >
          <fieldset>
            <legend>Selection Criteria</legend>
            <CheckField label="Use Scan" {...register('useScan', { onChange: () => list.clear() })} />
            <ComboField label="Payor" required={useScan} options={lookups.payors} error={errors.payor} {...register('payor')} />
            {useScan ? (
              <TextField label="Bordx No" required maxLength={20} autoFocus error={errors.bordxFrom} {...register('bordxFrom')} />
            ) : (
              <>
                <TextField label="Bordx No from" maxLength={20} autoFocus {...register('bordxFrom')} />
                <TextField label="Bordx No to" maxLength={20} {...register('bordxTo')} />
              </>
            )}
            <SelectField label="Status" options={deliveryStatusOptions} blank={false} {...register('status')} />
          </fieldset>

          <fieldset>
            <legend>{screen.title}</legend>
            <DateField control={control} name="sendDate" label="Date" hint="Applies to the ticked bordx." />
          </fieldset>

          <ActionBar label={`${screen.title} actions`}>
            <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
              Search
            </Button>
            <Button variant="ghost" onClick={send} disabled={busy}>
              Update
            </Button>
            <Button variant="ghost" onClick={exportList}>
              Print to File
            </Button>
            <Button variant="link" onClick={clear}>
              Clear
            </Button>
            <span className="spacer" />
            <Stat label="Records" value={list.rows.length} />
            <Stat label="Selected" value={list.checked.size} />
            <Stat label="Total Amt" value={formatMoney(total)} />
            <Button variant="link" onClick={() => navigate('/')}>
              Close
            </Button>
          </ActionBar>

          <DataGrid
            caption={`Bordx to send ${kind === 'to-payor' ? 'to the payor' : 'to accounts'}`}
            columns={columnsOf(kind)}
            rows={list.rows}
            rowKey={deliveryKey}
            check={{ checked: list.checked, onChange: list.change }}
            tall
            empty="No bordx. Enter the search criteria and press Search."
          />
        </SearchLayout>
      </form>
    </PageShell>
  )
}
