// Worksheet > Worksheet Tracking (legacy FrmWorksheetTracking, "Worksheets Tracking"): search the worksheets by many criteria,
// tick the ones to update and give them a pending status (cancelled or pending).

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
import { isScanCode, resolveScanCode } from '../../lib/scanCodes'
import { api, errorMessage } from '../../api/client'
import { isoDmy, isoToDmy, S } from '../case/caseShared'
import { DateRange, NumberRange, SelectRange, TextRange } from './RangeFields'
import { useTickList } from './useTickList'
import { useWorksheetLookups } from './useWorksheetLookups'
import {
  claimabilityOptions,
  isAlreadyListed,
  searchPendingOptions,
  trackingDefaults,
  trackingParams,
  trackingSchema,
  trackingTickProblem,
  trackingUpdateProblem,
  updatePendingOptions,
  worksheetKey,
} from './worksheetRules'
import type { SearchResult, TrackingValues } from './worksheetRules'

interface TrackingRow {
  payor: string | null
  caseNo: string
  claimVersion: number
  wksStatus: string | null
  pending: string | null
  approvedAmt: number | null
  payableToHospital: number | null
  payableToMember: number | null
  dor: string | null
  doa: string | null
  dod: string | null
  dClose: string | null
  dpo: string | null
  dtaC: string | null
  patient: string | null
  hospital: string | null
  daysOpen: number | null
  bordxNo: string | null
  bordxAmt: number | null
  bordxDate: string | null
  debitCreditRefNo: string | null
  firstDiag: string | null
  finalDiag: string | null
  admissionReason: string | null
  bordxed: boolean
}

const money = (v: number | null) => (v == null ? '' : formatMoney(v))
const dateColumn = (key: keyof TrackingRow, label: string): GridColumn<TrackingRow> => ({
  key,
  label,
  value: (r) => isoToDmy(r[key]),
  sortBy: (r) => S(r[key]),
})
const moneyColumn = (key: keyof TrackingRow, label: string): GridColumn<TrackingRow> => ({
  key,
  label,
  align: 'right',
  value: (r) => money(r[key] as number | null),
  sortBy: (r) => (r[key] as number | null) ?? 0,
})

const columns: GridColumn<TrackingRow>[] = [
  { key: 'payor', label: 'Payor' },
  { key: 'wksNo', label: 'Wks No', value: worksheetKey },
  { key: 'wksStatus', label: 'Wks Status' },
  { key: 'pending', label: 'Pending Status' },
  moneyColumn('approvedAmt', 'Approved Amt'),
  moneyColumn('payableToHospital', 'Payable to Hosp.'),
  moneyColumn('payableToMember', 'Payable to MBM'),
  dateColumn('dor', 'DOR (Case)'),
  dateColumn('doa', 'DOA'),
  dateColumn('dod', 'DOD'),
  dateColumn('dClose', 'DClose'),
  dateColumn('dpo', 'DPO'),
  dateColumn('dtaC', 'DTA/C'),
  { key: 'patient', label: 'Patient' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'daysOpen', label: 'No of Days (DOR - DClose)', align: 'right', sortBy: (r) => r.daysOpen ?? 0 },
  { key: 'bordxNo', label: 'Bordx No' },
  moneyColumn('bordxAmt', 'Bordx Amt'),
  dateColumn('bordxDate', 'Bordx Date'),
  { key: 'debitCreditRefNo', label: 'Debit/Credit Ref No' },
  { key: 'firstDiag', label: 'First Diag.' },
  { key: 'finalDiag', label: 'Final Diag.' },
  { key: 'admissionReason', label: 'Reason for Admission' },
  { key: 'bordxed', label: 'Status', value: (r) => (r.bordxed ? 'Bordxed' : '') },
]

const exportColumns: CsvColumn<TrackingRow>[] = columns.map((c) => ({
  label: c.label,
  value: (r) => (c.value ? c.value(r) : (r[c.key as keyof TrackingRow] as string | number | null)),
}))

const MAX_NOTICE = 'Only the first 5,000 worksheets are shown. Narrow the search to see the rest.'

async function load(v: TrackingValues) {
  return (await api.get<SearchResult<TrackingRow>>('/api/worksheet/tracking/search', { params: trackingParams(v) })).data
}

export function WorksheetTrackingPage() {
  const navigate = useNavigate()
  const list = useTickList<TrackingRow>(worksheetKey, trackingTickProblem)
  const [busy, setBusy] = useState(false)
  const [lastRange, setLastRange] = useState<TrackingValues | null>(null)
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
  } = useForm<TrackingValues>({ resolver: yupResolver(trackingSchema), defaultValues: trackingDefaults, mode: 'onTouched' })
  const [useScan, payor] = useWatch({ control, name: ['useScan', 'payor'] })
  const lookups = useWorksheetLookups(payor, { insuredTypes: true, groupCompanies: true })
  const totalApproved = list.rows.reduce((sum, r) => sum + (r.approvedAmt ?? 0), 0)

  /** CmdSearch_Click. A scan adds the worksheet to the list; a range replaces the list. A code starting LO opens another screen. */
  const search = handleSubmit(async (v) => {
    if (v.useScan && isScanCode(v.wksNoFrom)) {
      const outcome = resolveScanCode(v.wksNoFrom)
      setValue('wksNoFrom', '')
      if (outcome.kind === 'open') return navigate(outcome.route)
      return notify(outcome.kind === 'notMigrated' ? `${outcome.label} has not been migrated yet.` : `Unknown scan code ${outcome.code}.`, 'error')
    }
    if (v.useScan && isAlreadyListed(list.rows, v.wksNoFrom)) return notify('This case is already in the list.', 'info')
    setBusy(true)
    try {
      const found = await load(v)
      if (found.rows.length === 0) notify('No record found!', 'error')
      else if (v.useScan) list.append(found.rows)
      else {
        list.replace(found.rows)
        setLastRange(v)
      }
      if (found.truncated) notify(MAX_NOTICE, 'info')
      if (v.useScan) {
        setValue('wksNoFrom', '')
        setFocus('wksNoFrom')
      }
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  function clear() {
    reset(trackingDefaults)
    list.clear()
    setLastRange(null)
  }

  /** CmdUpdate_Click: date, pending status, then the ticked worksheets; the server refuses a worksheet that is already bordxed. */
  async function update() {
    const problem = trackingUpdateProblem(getValues())
    if (problem) {
      setError(problem.field, { message: problem.message })
      return setFocus(problem.field)
    }
    if (!(await trigger('updateDate'))) return setFocus('updateDate')
    if (list.ticked.length === 0) return notify('Please select at least one record to be updated!', 'error')
    if (!(await ask('Do you want to update the record?'))) return
    setBusy(true)
    try {
      const v = getValues()
      const { data } = await api.post<{ message: string }>('/api/worksheet/tracking/update', {
        date: isoDmy(v.updateDate),
        status: v.updatePending,
        items: list.ticked.map((r) => ({ caseNo: r.caseNo, claimVersion: r.claimVersion })),
      })
      notify(data.message, 'success')
      list.clear()
      if (!v.useScan && lastRange) list.replace((await load(lastRange)).rows)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportList() {
    if (list.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('worksheet-tracking.csv', exportColumns, list.rows)
  }

  const pair = { register, errors }

  return (
    <PageShell title="Worksheet Tracking" subtitle="Search worksheets, tick the ones to update and give them a pending status.">
      <form onSubmit={search} noValidate className="screen-form">
        <SearchLayout
          panel={
            <>
              <h4 className="ct-group">Worksheet</h4>
              <div className="ct-pair">
                <NumberRange label="Ver. No" from="versionFrom" to="versionTo" {...pair} />
              </div>
              <ComboField label="Group Company" options={lookups.groupCompanies} hint="Choose a payor first." {...register('groupCompany')} />
              <div className="ct-pair">
                <TextRange label="Plan Code" from="planFrom" to="planTo" maxLength={8} {...pair} />
              </div>
              <div className="ct-pair">
                <SelectRange label="Ins Type" from="insFrom" to="insTo" options={lookups.insuredTypes} {...pair} />
              </div>
              <div className="ct-pair">
                <TextRange label="Policy No" from="policyFrom" to="policyTo" maxLength={25} {...pair} />
              </div>
              <div className="ct-pair">
                <TextRange label="Member No" from="memberFrom" to="memberTo" maxLength={15} {...pair} />
              </div>
              <div className="ct-pair">
                <TextRange label="I/C No" from="icFrom" to="icTo" empty="icEmpty" maxLength={20} {...pair} />
              </div>
              <div className="ct-pair">
                <TextRange label="Bordx No" from="bordxFrom" to="bordxTo" empty="bordxEmpty" maxLength={20} {...pair} />
              </div>

              <h4 className="ct-group">Amounts</h4>
              <div className="ct-pair">
                <NumberRange label="App Amt" from="approvedFrom" to="approvedTo" {...pair} />
              </div>
              <div className="ct-pair">
                <NumberRange label="Pay2M" from="payMemberFrom" to="payMemberTo" {...pair} />
              </div>
              <div className="ct-pair">
                <NumberRange label="Pay2H" from="payHospitalFrom" to="payHospitalTo" {...pair} />
              </div>

              <h4 className="ct-group">Dates and diagnosis</h4>
              <div className="ct-pair">
                <DateRange label="DOA" from="doaFrom" to="doaTo" empty="doaEmpty" hint="Date of admission" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange label="DOD" from="dodFrom" to="dodTo" empty="dodEmpty" hint="Date of discharge" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange label="DPO" from="dpoFrom" to="dpoTo" empty="dpoEmpty" hint="Date passed on" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <TextRange label="First Diag." from="firstFrom" to="firstTo" empty="firstEmpty" maxLength={5} {...pair} />
              </div>
              <div className="ct-pair">
                <TextRange label="Final Diag." from="finalFrom" to="finalTo" empty="finalEmpty" maxLength={20} {...pair} />
              </div>
            </>
          }
        >
          <fieldset>
            <legend>Worksheet</legend>
            <CheckField label="Use Scan" {...register('useScan', { onChange: () => list.clear() })} />
            {useScan ? (
              <TextField
                label="Wks No"
                required
                maxLength={15}
                autoFocus
                hint="Type a code starting LO to open another screen."
                error={errors.wksNoFrom}
                {...register('wksNoFrom')}
              />
            ) : (
              <>
                <TextField label="Wks No from" maxLength={15} autoFocus {...register('wksNoFrom')} />
                <TextField label="Wks No to" maxLength={15} {...register('wksNoTo')} />
              </>
            )}
            <ComboField label="Payor" options={lookups.payors} {...register('payor', { onChange: () => setValue('groupCompany', '') })} />
            <SelectField label="Claimability" options={claimabilityOptions} {...register('claimability')} />
            <SelectField label="Pending Status" options={searchPendingOptions} {...register('pending')} />
            <CheckField label="Pending Status is empty" {...register('pendingEmpty')} />
          </fieldset>

          <fieldset>
            <legend>Update pending status</legend>
            <DateField control={control} name="updateDate" label="Date Update" hint="Applies to the ticked worksheets." />
            <SelectField label="Pending Status" options={updatePendingOptions} error={errors.updatePending} {...register('updatePending')} />
          </fieldset>

          <ActionBar label="Worksheet tracking actions">
            <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
              Search
            </Button>
            <Button variant="ghost" onClick={update} disabled={busy}>
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
            <Stat label="Total Amt" value={formatMoney(totalApproved)} />
            <Button variant="link" onClick={() => navigate('/')}>
              Close
            </Button>
          </ActionBar>

          <DataGrid
            caption="Worksheets"
            columns={columns}
            rows={list.rows}
            rowKey={worksheetKey}
            check={{ checked: list.checked, onChange: list.change }}
            tall
            empty="No worksheets. Enter the search criteria and press Search."
          />
        </SearchLayout>
      </form>
    </PageShell>
  )
}
