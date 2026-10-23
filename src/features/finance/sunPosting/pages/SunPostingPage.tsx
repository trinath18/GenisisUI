// Finance > SUN Posting (legacy frmPostingInvoiceMBM, "Member Invoice Posting"): search member invoices, tick them, post them to SUN
// under a new batch number and download the journal file the SUN import takes.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useQuery } from '@tanstack/react-query'
import * as yup from 'yup'
import { ComboField, DateField, SelectField, TextField } from '../../../../components/Field'
import type { Option } from '../../../../components/Field'
import { DataGrid } from '../../../../components/DataGrid'
import type { GridColumn } from '../../../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../../../components/Screen'
import { Button } from '../../../../components/Button'
import { errorMessage } from '../../../../api/client'
import { saveBlob } from '../../../../lib/download'
import { formatDate, formatMoney } from '../../../../lib/format'
import { parseDmy } from '../../../../lib/masks'
import { ask, notify } from '../../../../lib/notifyStore'
import { dmyDate, optionalText } from '../../../../lib/validation'
import { sunPostingApi } from '../api/sunPostingApi'
import { keyedLines, pairSelection, pickedInvoices, postProblem } from '../journalRules'
import type { CodeName, JournalLine, PostType, SearchMode, SunPostingSearchResult } from '../types'

type Line = JournalLine & { key: string }

interface Values {
  healthType: string
  payor: string
  invoiceDateFrom: string
  invoiceDateTo: string
  caseNoFrom: string
  caseNoTo: string
  postStatus: string
  postDateFrom: string
  postDateTo: string
  bordxStatus: string
  batchNoFrom: string
  batchNoTo: string
  bordxDateFrom: string
  bordxDateTo: string
  postType: string
  accPeriod: string
}

const defaults: Values = {
  healthType: '',
  payor: '',
  invoiceDateFrom: '',
  invoiceDateTo: '',
  caseNoFrom: '',
  caseNoTo: '',
  postStatus: '0',
  postDateFrom: '',
  postDateTo: '',
  bordxStatus: '1',
  batchNoFrom: '',
  batchNoTo: '',
  bordxDateFrom: '',
  bordxDateTo: '',
  postType: 'P',
  accPeriod: '',
}

const schema: yup.ObjectSchema<Values> = yup.object({
  healthType: optionalText(),
  payor: optionalText(),
  invoiceDateFrom: dmyDate(),
  invoiceDateTo: dmyDate(),
  caseNoFrom: optionalText(),
  caseNoTo: optionalText(),
  postStatus: optionalText(),
  postDateFrom: dmyDate(),
  postDateTo: dmyDate(),
  bordxStatus: optionalText(),
  batchNoFrom: optionalText(),
  batchNoTo: optionalText(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate(),
  postType: yup.string().default('P'),
  accPeriod: optionalText(),
})

/** dd/mm/yyyy -> yyyy-mm-dd for the API (blank stays blank). */
const iso = (dmy: string) => {
  const d = parseDmy(dmy)
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined
}

// Fixed lists (cboPostStatus, CboBordx, cboPostType). Kept in the page, not loaded, so the defaults ("0 - No", "1 - Yes", "P") are selected
// from the first render: a select whose options arrive later would drop its default and search without those filters.
const YES_NO: Option[] = [
  { value: '0', label: '0 - No' },
  { value: '1', label: '1 - Yes' },
]
const POST_TYPES: Option[] = [
  { value: 'P', label: 'P - Positive' },
  { value: 'N', label: 'N - Negative' },
]

const options = (list: CodeName[] | undefined, showCode = true): Option[] =>
  (list ?? []).map((o) => ({ value: o.code, label: showCode && o.code !== o.name ? `${o.code} - ${o.name}` : o.name }))

const columns: GridColumn<Line>[] = [
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
  { key: 'groupCompany', label: 'Grp Company' },
  { key: 'payor', label: 'Payor' },
  { key: 'caseNo', label: 'Case No' },
  { key: 'productCategory', label: 'Product Cat.' },
  { key: 'bordxRef', label: 'Bordx Ref' },
  { key: 'batchNo', label: 'BatchNo' },
]

/** Finance &gt; SUN Posting (legacy frmPostingInvoiceMBM). */
export function SunPostingPage() {
  const navigate = useNavigate()
  const lookups = useQuery({ queryKey: ['finance', 'sun-posting', 'lookups'], queryFn: sunPostingApi.lookups })
  const [result, setResult] = useState<SunPostingSearchResult | null>(null)
  const [mode, setMode] = useState<SearchMode>('all')
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  const [batchNo, setBatchNo] = useState('')
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, control, getValues } = useForm<Values>({ resolver: yupResolver(schema), defaultValues: defaults, mode: 'onTouched' })

  const lines: Line[] = keyedLines(result?.lines ?? [])
  const closed = lookups.data?.postingClosedMessage

  /** SearchRecords with the button's mode (Search / SearchCR / SearchDN). */
  const run = (next: SearchMode) =>
    handleSubmit(async (v) => {
      setBusy(true)
      setMode(next)
      setResult(null)
      setChecked(new Set())
      setBatchNo('')
      try {
        const found = await sunPostingApi.search({
          mode: next,
          healthType: v.healthType,
          payor: v.payor,
          invoiceDateFrom: iso(v.invoiceDateFrom),
          invoiceDateTo: iso(v.invoiceDateTo),
          caseNoFrom: v.caseNoFrom,
          caseNoTo: v.caseNoTo,
          postStatus: v.postStatus,
          postDateFrom: iso(v.postDateFrom),
          postDateTo: iso(v.postDateTo),
          bordxStatus: v.bordxStatus,
          batchNoFrom: v.batchNoFrom,
          batchNoTo: v.batchNoTo,
          bordxDateFrom: iso(v.bordxDateFrom),
          bordxDateTo: iso(v.bordxDateTo),
          postType: v.postType as PostType,
        })
        setResult(found)
        if (found.invoices === 0) notify('No record selected ! ', 'error')
        if (found.truncated) notify('Only the first 5000 invoices are listed. Narrow the search to see the rest.', 'warn')
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

  async function downloadJournal(batch: string, type?: PostType) {
    try {
      const { blob, fileName } = await sunPostingApi.journal(batch, type, iso(getValues('invoiceDateTo')))
      saveBlob(blob, fileName)
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  /** CmdPost_Click. */
  async function post() {
    const v = getValues()
    const picks = pickedInvoices(lines, checked)
    if (mode !== 'all') return notify('Search the posting list (Search) before posting.', 'error')
    if (closed) return notify(closed, 'error')
    const problem = postProblem({
      picked: picks.length,
      invoiceDateTo: v.invoiceDateTo,
      bordxStatus: v.bordxStatus,
      posted: !!result?.posted,
      accPeriod: v.accPeriod,
    })
    if (problem) return notify(problem, 'error')
    if (!(await ask('Do you want to Post the record(s) ?'))) return
    setBusy(true)
    try {
      const done = await sunPostingApi.post({
        accPeriod: v.accPeriod,
        postType: v.postType as PostType,
        invoiceDateTo: iso(v.invoiceDateTo) ?? null,
        bordxStatus: v.bordxStatus,
        items: picks,
      })
      setBatchNo(done.batchNo)
      setResult(done.journal)
      setChecked(new Set())
      notify(`${done.message} Batch No ${done.batchNo}`, 'success')
      await downloadJournal(done.batchNo, v.postType as PostType)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Print to File: the listed lines as CSV (the desktop exported the list to Excel). */
  function exportList() {
    if (lines.length === 0) return notify('Report cannot be printed without any record.', 'info')
    const header = [
      'Chk',
      'J/T',
      'J/S',
      'DB',
      'Trans.Ref.',
      'AccPeriod',
      'Trans.Date',
      'Description',
      'AccCode',
      'Amt',
      'D/C',
      'Hospital',
      'Grp Company',
      'Payor',
      'Case No',
      'Product Cat.',
      'Bordx Ref',
      'BatchNo',
      'Index',
    ]
    const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
    const body = lines.map((l) =>
      [
        l.status,
        l.journalType,
        l.journalSource,
        l.database,
        l.transRef,
        l.accPeriod ?? '',
        formatDate(l.transDate),
        l.description,
        l.accCode,
        l.amount.toFixed(2),
        l.debitCredit,
        l.hospital,
        l.groupCompany ?? '',
        l.payor ?? '',
        l.caseNo,
        l.productCategory ?? '',
        l.bordxRef ?? '',
        l.batchNo ?? '',
        l.index ?? '',
      ]
        .map((c) => esc(String(c)))
        .join(','),
    )
    saveBlob(new Blob(['\ufeff', [header.join(','), ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'sun-posting-member-invoices.csv')
  }

  function clear() {
    reset(defaults)
    setResult(null)
    setChecked(new Set())
    setBatchNo('')
    setMode('all')
  }

  return (
    <PageShell title="SUN Posting" subtitle="Member Invoice Posting (journal MJC / MJD to SUN).">
      {closed && (
        <p className="warning" role="alert">
          {closed} Posting is not available now; you can still search.
        </p>
      )}
      <form onSubmit={(e) => (e.preventDefault(), run('all'))} noValidate className="screen-form">
        <fieldset>
          <legend>Selection Criteria</legend>
          <SelectField label="Health Type" options={options(lookups.data?.healthTypes)} {...register('healthType')} />
          <ComboField label="Payor" options={options(lookups.data?.payors)} {...register('payor')} />
          <DateField control={control} name="invoiceDateFrom" label="Claim Reg Date from" />
          <DateField control={control} name="invoiceDateTo" label="Claim Reg Date to" />
          <TextField label="Claim No. from" maxLength={30} {...register('caseNoFrom')} />
          <TextField label="Claim No. to" maxLength={30} {...register('caseNoTo')} />
          <SelectField label="Post Status" options={YES_NO} {...register('postStatus')} />
          <DateField control={control} name="postDateFrom" label="Post Date from" />
          <DateField control={control} name="postDateTo" label="Post Date to" />
          <SelectField label="Bordx Status" options={YES_NO} {...register('bordxStatus')} />
          <DateField control={control} name="bordxDateFrom" label="Bordx Date from" />
          <DateField control={control} name="bordxDateTo" label="Bordx Date to" />
          <TextField label="Post Batch No. from" maxLength={5} {...register('batchNoFrom')} />
          <TextField label="Post Batch No. to" maxLength={5} {...register('batchNoTo')} />
          <SelectField label="Post Type" blank={false} options={POST_TYPES} {...register('postType')} />
        </fieldset>

        <fieldset>
          <legend>Post Information</legend>
          <SelectField label="A/C Period" options={options(lookups.data?.accountingPeriods, false)} {...register('accPeriod')} />
          {batchNo && <Stat label="Batch No" value={batchNo} />}
        </fieldset>

        <ActionBar label="SUN posting actions">
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
            Post ({pickedInvoices(lines, checked).length})
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
          caption={mode === 'all' ? 'Member invoice journal' : mode === 'credit' ? 'Credit lines' : 'Debit lines'}
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
