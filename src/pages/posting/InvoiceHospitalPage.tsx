// Posting > Invoice > Hospital (legacy frmPostingInvoiceHosp, "Posting - HospInv"): search the hospital invoices, tick them, post them to SUN under a new batch number and download the journal file the SUN import
// takes. Search CR and Search DN list the credit and the debit lines alone.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import { ComboField, DateField, SelectField, TextField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { api, errorMessage, rethrowBlobError } from '../../api/client'
import { keyedLines, pairSelection } from '../../features/finance/sunPosting/journalRules'
import type { SearchMode, SunPostingSearchResult, SunPostResult } from '../../features/finance/sunPosting/types'
import { downloadCsvRows } from '../../lib/exportCsv'
import { fileNameFromDisposition, saveBlob } from '../../lib/download'
import { formatDate, formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import {
  hospitalDefaults,
  hospitalSchema,
  isoDay,
  journalRows,
  payorsOf,
  pickedIndexes,
  postProblem,
  postRequest,
  searchParams,
  yesNoOptions,
} from './invoiceHospitalRules'
import type { HospitalLookups, HospitalValues, KeyedLine } from './invoiceHospitalRules'

const base = '/api/posting/invoice-hospital'

const columns: GridColumn<KeyedLine>[] = [
  { key: 'status', label: 'Chk' },
  { key: 'journalType', label: 'J/T' },
  { key: 'database', label: 'DB' },
  { key: 'transRef', label: 'Trans.Ref.' },
  { key: 'accPeriod', label: 'AccPeriod' },
  { key: 'transDate', label: 'Trans.Date', value: (r) => formatDate(r.transDate), sortBy: (r) => r.transDate ?? '' },
  { key: 'description', label: 'Description' },
  { key: 'accCode', label: 'AccCode' },
  { key: 'amount', label: 'Amt', align: 'right', value: (r) => formatMoney(r.amount), sortBy: (r) => r.amount },
  { key: 'debitCredit', label: 'D/C', align: 'center' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'payor', label: 'Payor' },
  { key: 'caseNo', label: 'Case No' },
  { key: 'productCategory', label: 'Product Cat.' },
  { key: 'bordxRef', label: 'Bordx Ref' },
  { key: 'batchNo', label: 'BatchNo' },
]

const options = (list: { code: string; name: string }[] | undefined, showCode = true): Option[] =>
  (list ?? []).map((o) => ({ value: o.code, label: showCode && o.code !== o.name ? `${o.code} - ${o.name}` : o.name }))

/** Posting &gt; Invoice &gt; Hospital (legacy frmPostingInvoiceHosp). */
export function InvoiceHospitalPage() {
  const navigate = useNavigate()
  const lookups = useQuery({
    queryKey: ['posting', 'invoice-hospital', 'lookups'],
    queryFn: async () => (await api.get<HospitalLookups>(`${base}/lookups`)).data,
  })
  const [result, setResult] = useState<SunPostingSearchResult | null>(null)
  const [mode, setMode] = useState<SearchMode>('all')
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [batchNo, setBatchNo] = useState('')
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, control, getValues } = useForm<HospitalValues>({
    resolver: yupResolver(hospitalSchema),
    defaultValues: hospitalDefaults,
    mode: 'onTouched',
  })
  const healthType = useWatch({ control, name: 'healthType' })

  const lines: KeyedLine[] = keyedLines(result?.lines ?? [])
  const closed = lookups.data?.postingClosedMessage
  const payors = payorsOf(lookups.data?.payors ?? [], healthType).map((p) => ({ code: p.code, name: p.name }))

  /** SearchRecord with the button's mode (Search / SearchCR / SearchDN). */
  const run = (next: SearchMode) =>
    handleSubmit(async (v) => {
      setBusy(true)
      setMode(next)
      setResult(null)
      setChecked(new Set())
      setBatchNo('')
      try {
        const { data } = await api.get<SunPostingSearchResult>(`${base}/search`, { params: searchParams(next, v) })
        setResult(data)
        if (data.invoices === 0) notify('No record selected ! ', 'error')
        if (data.truncated) notify('Only the first 5000 invoices are listed. Narrow the search to see the rest.', 'warn')
      } catch (e) {
        notify(errorMessage(e), 'error')
      } finally {
        setBusy(false)
      }
    })()

  function changeChecked(next: Set<string>) {
    if (mode !== 'all') return
    if (result?.posted) return notify('Record(s) has been posted ! ', 'error')
    setChecked(pairSelection(lines, checked, next))
  }

  async function downloadJournal(batch: string) {
    try {
      const response = await api.get<Blob>(`${base}/journal`, {
        params: { batchNo: batch, fileDate: isoDay(getValues('invoiceDateTo')) },
        responseType: 'blob',
      })
      saveBlob(response.data, fileNameFromDisposition(response.headers['content-disposition'], `${batch} RC-HospInv.csv`))
    } catch (e) {
      try {
        await rethrowBlobError(e)
      } catch (inner) {
        notify(errorMessage(inner), 'error')
      }
    }
  }

  /** CmdPost_Click. */
  async function post() {
    const v = getValues()
    const picked = pickedIndexes(lines, checked)
    if (mode !== 'all') return notify('Search the posting list (Search) before posting.', 'error')
    if (closed) return notify(closed, 'error')
    const problem = postProblem({
      picked: picked.length,
      invoiceDateTo: v.invoiceDateTo,
      bordxStatus: v.bordxStatus,
      posted: !!result?.posted,
      accPeriod: v.accPeriod,
    })
    if (problem) return notify(problem, 'error')
    if (!(await ask('Do you want to Post record(s) ?'))) return
    setBusy(true)
    try {
      const { data } = await api.post<SunPostResult>(`${base}/post`, postRequest(v, picked))
      setBatchNo(data.batchNo)
      setResult(data.journal)
      setChecked(new Set())
      notify(`${data.message.trim()} Batch No ${data.batchNo}`, 'success')
      await downloadJournal(data.batchNo)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** CmdPrintFile_Click: the listed lines as CSV. */
  function exportList() {
    if (lines.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsvRows('posting-invoice-hospital.csv', journalRows(lines))
  }

  function clear() {
    reset(hospitalDefaults)
    setResult(null)
    setChecked(new Set())
    setBatchNo('')
    setMode('all')
  }

  return (
    <PageShell title="Posting - HospInv" subtitle="Hospital invoice posting (journal RC to SUN).">
      {closed && (
        <p className="warning" role="alert">
          {closed} Posting is not available now; you can still search.
        </p>
      )}
      <form onSubmit={(e) => (e.preventDefault(), run('all'))} noValidate className="screen-form">
        <fieldset>
          <legend>Selection Criteria</legend>
          <SelectField label="Health Type" options={options(lookups.data?.healthTypes)} {...register('healthType')} />
          <ComboField label="Hospital" options={options(lookups.data?.hospitals, false)} {...register('hospital')} />
          <ComboField label="Payor" options={options(payors)} {...register('payor')} />
          <DateField control={control} name="invoiceDateFrom" label="Invoice Date from" />
          <DateField control={control} name="invoiceDateTo" label="Invoice Date to" />
          <TextField label="Invoice No. from" maxLength={40} {...register('invoiceNoFrom')} />
          <TextField label="Invoice No. to" maxLength={40} {...register('invoiceNoTo')} />
          <SelectField label="Post Status" blank={false} options={yesNoOptions} {...register('postStatus')} />
          <DateField control={control} name="postDateFrom" label="Post Date from" />
          <DateField control={control} name="postDateTo" label="Post Date to" />
          <SelectField label="Bordx Status" blank={false} options={yesNoOptions} {...register('bordxStatus')} />
          <DateField control={control} name="bordxDateFrom" label="Bordx Date from" />
          <DateField control={control} name="bordxDateTo" label="Bordx Date to" />
          <TextField label="Post Batch No. from" maxLength={5} {...register('batchNoFrom')} />
          <TextField label="Post Batch No. to" maxLength={5} {...register('batchNoTo')} />
        </fieldset>

        <fieldset>
          <legend>Post Information</legend>
          <SelectField label="A/C Period" options={options(lookups.data?.accountingPeriods, false)} {...register('accPeriod')} />
          {batchNo && <Stat label="Batch No" value={batchNo} />}
        </fieldset>

        <ActionBar label="Hospital invoice posting actions">
          <Button variant="primary" type="submit" busy={busy && mode === 'all'} busyLabel="Searching…" disabled={busy}>
            Search
          </Button>
          <Button variant="ghost" onClick={() => run('credit')} disabled={busy}>
            Search CR
          </Button>
          <Button variant="ghost" onClick={() => run('debit')} disabled={busy}>
            Search DN
          </Button>
          <Button variant="ghost" onClick={post} disabled={busy || !!closed || mode !== 'all'}>
            Post ({pickedIndexes(lines, checked).length})
          </Button>
          <Button variant="ghost" onClick={exportList} disabled={busy}>
            Print to File
          </Button>
          {batchNo && (
            <Button variant="ghost" onClick={() => downloadJournal(batchNo)} disabled={busy}>
              Journal File
            </Button>
          )}
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Record(s)" value={result?.invoices ?? 0} />
          <Stat label="DR Amt" value={formatMoney(result?.debitTotal ?? 0)} />
          <Stat label="CR Amt" value={formatMoney(result?.creditTotal ?? 0)} />
          <Stat label="Posted" value={result?.posted ? 'Yes' : 'No'} />
          <Button variant="link" onClick={() => navigate('/')}>
            Exit
          </Button>
        </ActionBar>

        <DataGrid
          caption={mode === 'all' ? 'Hospital invoice journal' : mode === 'credit' ? 'Credit lines' : 'Debit lines'}
          columns={columns}
          rows={lines}
          rowKey={(r) => r.key}
          check={mode === 'all' ? { checked, onChange: changeChecked } : undefined}
          tall
          empty="No invoices. Enter the criteria and press Search."
        />
      </form>
    </PageShell>
  )
}
