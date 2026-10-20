// Case > Inpatient Case Listing (legacy mnuAppCase -> FrmWksBordx, "Select Worksheets for Bordx"):
// search worksheets, tick the ones to include, then generate the bordx and review the generated bordx list.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { CheckField, ComboField, DateField, SelectField, TextField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Tabs } from '../../components/Tabs'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy, S } from './caseShared'
import { NO_DOCUMENTS, needsDocuments, selectionProblem } from './listingRules'
import { useScreenLookups } from './useScreenLookups'

interface WorksheetRow {
  payor: string
  caseNo: string
  claimVersion: string
  wksNo: string
  cashType: string
  hosAmt: number
  appAmt: number
  doa: string
  dod: string
  patient: string
  hospital: string
  groupCompany: string
  planCode: string
  icdCode: string
  btbg: string
  insuredType: string
  claimability: string
  hltType: string
}

interface WorksheetDto {
  caseNo: string
  claimVersion: number
  payor: string | null
  appAmt: number | null
  hosAmt: number | null
  doa: string | null
  dod: string | null
  cashType: string | null
  hospital: string | null
  groupCompany: string | null
  planCode: string | null
  icdCode: string | null
  btbg: string | null
  insuredType: string | null
  claimability: string | null
  hltType: string | null
  wksNo: string
  patient: string | null
}

/** A grid row of the desktop's ListView: empty BTBG shows as N. */
const toWorksheet = (d: WorksheetDto): WorksheetRow => ({
  payor: S(d.payor),
  caseNo: d.caseNo,
  claimVersion: String(d.claimVersion),
  wksNo: d.wksNo,
  cashType: S(d.cashType),
  hosAmt: d.hosAmt ?? 0,
  appAmt: d.appAmt ?? 0,
  doa: isoToDmy(d.doa),
  dod: isoToDmy(d.dod),
  patient: S(d.patient),
  hospital: S(d.hospital),
  groupCompany: S(d.groupCompany),
  planCode: S(d.planCode),
  icdCode: S(d.icdCode),
  btbg: S(d.btbg) || 'N',
  insuredType: S(d.insuredType),
  claimability: S(d.claimability),
  hltType: S(d.hltType),
})

interface BordxLineDto {
  claimNo: string
  bordxNo: string
  bordxDate: string
  bordxAmount: number
}

interface BordxRow {
  claimNo: string
  bordxNo: string
  bordxDate: string
  bordxAmount: number
}

interface Values {
  useScan: boolean
  wksNoFrom: string
  wksNoTo: string
  version: string
  bordxOption: string
  bordxStatus: string
  payor: string
  doaFrom: string
  doaTo: string
  doaEmpty: boolean
  dodFrom: string
  dodTo: string
  dodEmpty: boolean
}

const defaults: Values = {
  useScan: true,
  wksNoFrom: '',
  wksNoTo: '',
  version: '',
  bordxOption: '',
  bordxStatus: '',
  payor: '',
  doaFrom: '',
  doaTo: '',
  doaEmpty: false,
  dodFrom: '',
  dodTo: '',
  dodEmpty: false,
}

const bordxOptions: Option[] = [
  { value: 'Single Claim', label: 'Single Claim' },
  { value: 'Multiple Claims', label: 'Multiple Claims' },
]
const bordxStatuses: Option[] = [{ value: 'Yes', label: 'Yes' }]

const schema: yup.ObjectSchema<Values> = yup.object({
  useScan: yup.boolean().default(true),
  wksNoFrom: yup
    .string()
    .trim()
    .default('')
    .when('useScan', { is: true, then: (s) => s.required('Please Enter Worksheet No') }),
  wksNoTo: optionalText(),
  version: optionalText(),
  bordxOption: optionalText(),
  bordxStatus: optionalText(),
  payor: optionalText(),
  doaFrom: dmyDate(),
  doaTo: dmyDate(),
  doaEmpty: yup.boolean().default(false),
  dodFrom: dmyDate(),
  dodTo: dmyDate(),
  dodEmpty: yup.boolean().default(false),
})

const money = (v: number) => formatMoney(v)

const worksheetColumns: GridColumn<WorksheetRow>[] = [
  { key: 'payor', label: 'Payor' },
  { key: 'caseNo', label: 'Case No' },
  { key: 'claimVersion', label: 'Claim Version' },
  { key: 'wksNo', label: 'Wks No' },
  { key: 'cashType', label: 'Cash Type' },
  { key: 'hosAmt', label: 'Hos Amt', align: 'right', value: (r) => money(r.hosAmt), sortBy: (r) => r.hosAmt },
  { key: 'appAmt', label: 'App Amt', align: 'right', value: (r) => money(r.appAmt), sortBy: (r) => r.appAmt },
  { key: 'doa', label: 'DOA', sortBy: (r) => isoDmy(r.doa) ?? '' },
  { key: 'dod', label: 'DOD', sortBy: (r) => isoDmy(r.dod) ?? '' },
  { key: 'patient', label: 'Patient' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'groupCompany', label: 'Group Company' },
  { key: 'planCode', label: 'Plan Code' },
  { key: 'icdCode', label: 'ICD Code' },
  { key: 'btbg', label: 'BTBG' },
  { key: 'insuredType', label: 'Insured Type' },
  { key: 'claimability', label: 'Claimability' },
  { key: 'hltType', label: 'HLT Type' },
]

const bordxColumns: GridColumn<BordxRow>[] = [
  { key: 'claimNo', label: 'Claim No' },
  { key: 'bordxNo', label: 'Bordx No' },
  { key: 'bordxDate', label: 'Bordx Date', sortBy: (r) => isoDmy(r.bordxDate) ?? '' },
  { key: 'bordxAmount', label: 'Bordx Amt', align: 'right', value: (r) => money(r.bordxAmount), sortBy: (r) => r.bordxAmount },
]

const exportColumns: CsvColumn<WorksheetRow>[] = worksheetColumns.map((c) => ({
  label: c.label,
  value: (r) => (c.value ? c.value(r) : (r[c.key as keyof WorksheetRow] as string)),
}))

export function CaseListingPage() {
  const navigate = useNavigate()
  const { payors, worksheetVersions } = useScreenLookups({ payors: true })
  const [worksheets, setWorksheets] = useState<WorksheetRow[]>([])
  const [bordxList, setBordxList] = useState<BordxRow[]>([])
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [selectedBordx, setSelectedBordx] = useState<BordxRow | null>(null)
  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  })
  const [useScan, doaEmpty, dodEmpty] = useWatch({ control, name: ['useScan', 'doaEmpty', 'dodEmpty'] })
  const totalApproved = worksheets.reduce((sum, r) => sum + r.appAmt, 0)

  /** CmdSearch_Click. Scan mode adds the scanned worksheet to the list; a range replaces it. */
  const search = handleSubmit(async (v) => {
    setTab(0)
    setSelectedBordx(null)
    setBusy(true)
    try {
      const { data } = await api.get<WorksheetDto[]>('/api/case/listing/search', {
        params: {
          useScan: v.useScan,
          wksNoFrom: v.wksNoFrom.trim() || undefined,
          wksNoTo: v.useScan ? undefined : v.wksNoTo.trim() || undefined,
          version: v.useScan && v.version ? Number(v.version) : undefined,
          payor: v.payor || undefined,
          doaFrom: v.doaEmpty ? undefined : (isoDmy(v.doaFrom) ?? undefined),
          doaTo: v.doaEmpty ? undefined : (isoDmy(v.doaTo) ?? undefined),
          doaEmpty: v.doaEmpty,
          dodFrom: v.dodEmpty ? undefined : (isoDmy(v.dodFrom) ?? undefined),
          dodTo: v.dodEmpty ? undefined : (isoDmy(v.dodTo) ?? undefined),
          dodEmpty: v.dodEmpty,
          bordxStatusYes: v.bordxStatus === 'Yes',
        },
      })
      const found = data.map(toWorksheet)
      if (found.length === 0) notify('No record found!', 'error')
      else if (v.useScan) {
        const fresh = found.filter((f) => !worksheets.some((w) => w.wksNo === f.wksNo))
        if (fresh.length === 0) notify('This worksheet is already in the list.', 'info')
        setWorksheets([...worksheets, ...fresh])
      } else {
        setWorksheets(found)
        setChecked(new Set())
      }
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
    reset(defaults)
    setWorksheets([])
    setBordxList([])
    setChecked(new Set())
    setSelectedBordx(null)
    setTab(0)
  }

  /** lstWorksheetTrackList_ItemCheck: a ticked row must pass the selection rules, including the scanned-document check on the server. */
  async function changeChecked(next: Set<string>) {
    const added = worksheets.filter((w) => next.has(w.wksNo) && !checked.has(w.wksNo))
    const removed = [...checked].filter((k) => !next.has(k))
    const accepted: string[] = []
    const needDocs: WorksheetRow[] = []
    const problems = new Map<string, number>()
    const flag = (text: string) => problems.set(text, (problems.get(text) ?? 0) + 1)
    for (const r of added) {
      const problem = selectionProblem(r)
      if (problem) flag(problem)
      else if (needsDocuments(r)) needDocs.push(r)
      else accepted.push(r.wksNo)
    }
    if (needDocs.length > 0) {
      try {
        const { data } = await api.post<{ available: boolean; cases: Record<string, boolean> }>('/api/case/listing/documents', {
          cases: [...new Set(needDocs.map((r) => r.caseNo))],
        })
        for (const r of needDocs) {
          if (!data.available || data.cases[r.caseNo]) accepted.push(r.wksNo)
          else flag(NO_DOCUMENTS)
        }
      } catch (e) {
        notify(errorMessage(e), 'error')
      }
    }
    problems.forEach((count, text) => notify(count > 1 ? `${text} (${count} worksheets were not selected)` : text, 'error'))
    setChecked((prev) => {
      const n = new Set(prev)
      removed.forEach((k) => n.delete(k))
      accepted.forEach((k) => n.add(k))
      return n
    })
  }

  async function generateBordx() {
    if (worksheets.length === 0) return notify('Please select a record before proceeding!', 'error')
    if (checked.size === 0) return notify('Please select at least one record to be updated!', 'error')
    if (!getValues('bordxOption')) {
      setError('bordxOption', { message: 'Please select Bordx option' })
      return setFocus('bordxOption')
    }
    if (!(await ask('Do you want to update the record?'))) return
    setBusy(true)
    try {
      const items = worksheets.filter((w) => checked.has(w.wksNo)).map((w) => ({ caseNo: w.caseNo, claimVersion: Number(w.claimVersion) }))
      const { data } = await api.post<{ message: string; lines: BordxLineDto[] }>('/api/case/listing/bordx', { option: getValues('bordxOption'), items })
      const done = new Set(data.lines.map((l) => l.claimNo))
      setBordxList(data.lines.map((l) => ({ ...l, bordxDate: isoToDmy(l.bordxDate) })))
      setWorksheets((rows) => rows.filter((w) => !done.has(w.wksNo)))
      setChecked(new Set())
      setTab(1)
      notify(data.message, 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportList() {
    if (worksheets.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('inpatient-case-listing.csv', exportColumns, worksheets)
  }

  const worksheetsPanel = (
    <DataGrid
      caption="Worksheets"
      columns={worksheetColumns}
      rows={worksheets}
      rowKey={(r) => r.wksNo}
      check={{ checked, onChange: changeChecked }}
      tall
      empty="No worksheets. Enter the search criteria and press Search."
    />
  )

  const bordxPanel = (
    <DataGrid
      caption="Generated bordx"
      columns={bordxColumns}
      rows={bordxList}
      rowKey={(r) => r.claimNo}
      selectedKey={selectedBordx?.claimNo}
      onSelect={setSelectedBordx}
      tall
      empty="No bordx generated yet."
    />
  )

  return (
    <PageShell title="Inpatient Case Listing" subtitle="Select worksheets for bordx.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Selection Criteria</legend>
          <CheckField label="Use Scan" {...register('useScan')} />
          {useScan ? (
            <>
              <TextField label="Wks No" required maxLength={15} autoFocus error={errors.wksNoFrom} {...register('wksNoFrom')} />
              <ComboField label="Version" options={worksheetVersions} {...register('version')} />
            </>
          ) : (
            <>
              <TextField label="Wks No from" maxLength={15} autoFocus {...register('wksNoFrom')} />
              <TextField label="Wks No to" maxLength={15} {...register('wksNoTo')} />
            </>
          )}
          <SelectField label="Bordx Option" options={bordxOptions} error={errors.bordxOption} {...register('bordxOption')} />
          <SelectField label="Bordx Status" options={bordxStatuses} {...register('bordxStatus')} />
          <ComboField label="Payor" options={payors} {...register('payor')} />
          <DateField control={control} name="doaFrom" label="DOA from" hint="Date of admission" disabled={doaEmpty} />
          <DateField control={control} name="doaTo" label="DOA to" disabled={doaEmpty} />
          <CheckField label="DOA is empty" {...register('doaEmpty')} />
          <DateField control={control} name="dodFrom" label="DOD from" hint="Date of discharge" disabled={dodEmpty} />
          <DateField control={control} name="dodTo" label="DOD to" disabled={dodEmpty} />
          <CheckField label="DOD is empty" {...register('dodEmpty')} />
        </fieldset>

        <ActionBar label="Worksheet listing actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="ghost" onClick={generateBordx} disabled={busy}>
            Generate Bordx
          </Button>
          <Button variant="ghost" onClick={exportList}>
            Export
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          {selectedBordx && <Stat label="Bordx No" value={selectedBordx.bordxNo} />}
          <Stat label="Records" value={worksheets.length} />
          <Stat label="Selected" value={checked.size} />
          <Stat label="Total Amt" value={money(totalApproved)} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>

        <Tabs
          label="Worksheet listing sections"
          tabs={['Worksheets', 'Generated Bordx']}
          panels={[worksheetsPanel, bordxPanel]}
          active={tab}
          onChange={setTab}
        />
      </form>
    </PageShell>
  )
}
