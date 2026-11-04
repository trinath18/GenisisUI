// Payment > Enquiry > Payment To Member (legacy FrmEnquiryPayMember, "Enquiry Payment to Member"): the claims with a debit / credit note and their payments, the receipts of those claims and the payments that were
// reissued. Scan a claim number to add it to the lists (a code that starts with LO opens another screen), or search; Print to File writes the Payment To Member list as a CSV.

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
import { Tabs } from '../../components/Tabs'
import { formatMoney } from '../../lib/format'
import { downloadCsvRows } from '../../lib/exportCsv'
import { notify } from '../../lib/notifyStore'
import { isScanCode, resolveScanCode } from '../../lib/scanCodes'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import {
  fileRows,
  healthTypeOptions,
  monthOptions,
  newReceipts,
  paymentColumns,
  paymentOptions,
  payorOptions,
  receiptColumns,
  reissueColumns,
  scanProblem,
  searchDefaults,
  searchParams,
  searchSchema,
  wsStatusOptions,
  yearOptions,
} from './paymentEnquiryMemberRules'
import type { Lookups, PaymentRow, ReceiptRow, SearchResult, SearchValues } from './paymentEnquiryMemberRules'

const base = '/api/payment/enquiry-member'

type Keyed<T> = T & { key: string }

function gridColumns<T extends object>(
  cols: { label: string; right?: boolean; value: (r: T) => string; sort?: (r: T) => string | number }[],
): GridColumn<Keyed<T>>[] {
  return cols.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, sortBy: c.sort, align: c.right ? 'right' : undefined }))
}

const paymentGrid = gridColumns<PaymentRow>(paymentColumns)
const receiptGrid = gridColumns<ReceiptRow>(receiptColumns)
const reissueGrid = gridColumns<PaymentRow>(reissueColumns)

export function PaymentEnquiryMemberPage() {
  const navigate = useNavigate()
  const lookups = useQuery({
    queryKey: ['payment-enquiry-member', 'lookups'],
    queryFn: async () => (await api.get<Lookups>(`${base}/lookups`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const [payments, setPayments] = useState<Keyed<PaymentRow>[]>([])
  const [receipts, setReceipts] = useState<Keyed<ReceiptRow>[]>([])
  const [reissues, setReissues] = useState<Keyed<PaymentRow>[]>([])
  const [busy, setBusy] = useState(false)
  const counter = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const form = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const { register, control, handleSubmit, setValue, reset, formState } = form
  const scan = useWatch({ control, name: 'scan' })
  const key = <T extends object>(r: T): Keyed<T> => ({ ...r, key: String(counter.current++) })

  /** cmdSearch_Click: a scanned claim is added to the lists; otherwise the lists are replaced. */
  async function searchFor(values: SearchValues) {
    if (values.scan && isScanCode(values.caseNo)) {
      const outcome = resolveScanCode(values.caseNo)
      setValue('caseNo', '')
      if (outcome.kind === 'open') return navigate(outcome.route)
      return notify(outcome.kind === 'notMigrated' ? `${outcome.label} has not been migrated yet.` : `Unknown scan code ${outcome.code}.`, 'error')
    }
    const problem = scanProblem(values, payments)
    if (problem) return notify(problem, 'error')
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    try {
      const { data } = await api.get<SearchResult>(base, { params: searchParams(values), signal: abort.signal })
      const added = data.payments.map(key)
      if (values.scan) {
        setPayments((prev) => [...prev, ...added])
        setReceipts((prev) => [...prev, ...newReceipts(prev, data.receipts).map(key)])
        setReissues((prev) => [...prev, ...data.reissues.map(key)])
        setValue('caseNo', '')
      } else {
        setPayments(added)
        setReceipts(data.receipts.map(key))
        setReissues(data.reissues.map(key))
      }
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

  /** cmdPrint_Click: the Payment To Member list as a CSV file. */
  function print() {
    if (payments.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsvRows('payment-to-member.csv', fileRows(payments))
  }

  /** ChkScan_Click: the lists are emptied. */
  function clearLists() {
    setPayments([])
    setReceipts([])
    setReissues([])
  }

  /** cmdClear_Click: the boxes and the lists; Use Scan is on again. */
  function clear() {
    reset(searchDefaults)
    clearLists()
  }

  const { errors } = formState
  const l = lookups.data
  const totalPayable = payments.reduce((s, r) => s + (r.payable ?? 0), 0)
  const totalPaid = payments.reduce((s, r) => s + (r.paidAmt ?? 0), 0)
  const rowKey = (r: { key: string }) => r.key

  return (
    <PageShell title="Enquiry Payment to Member" subtitle="Claims payable to members, their receipts and the payments reissued.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search</legend>
          <CheckField label="Use Scan" {...register('scan', { onChange: () => clearLists() })} />
          <TextField label={scan ? 'Case No' : 'Case No'} maxLength={30} error={errors.caseNo} {...register('caseNo')} />
          <TextField label="Ver" maxLength={4} error={errors.version} {...register('version')} />
          <TextField label="Member No" maxLength={30} error={errors.mbmNo} {...register('mbmNo')} />
          <TextField label="Member Name" maxLength={100} error={errors.mbmName} {...register('mbmName')} />
          <ComboField label="Payor" options={payorOptions(l?.payors ?? [])} {...register('payor')} />
          <SelectField label="Health Type" options={healthTypeOptions(l?.healthTypes ?? [])} {...register('healthType')} />
          <SelectField label="WS Claimability" options={wsStatusOptions} {...register('wsStatus')} />
          <SelectField label="Pymt Status" blank={false} options={paymentOptions} {...register('payment')} />
          <TextRange label="PV No" from="pvNoFrom" to="pvNoTo" register={register} errors={errors} empty="blankPvNo" />
          <DateRange label="PV Date" from="pvDateFrom" to="pvDateTo" control={control} register={register} empty="blankPvDate" />
          <TextRange label="CR No" from="crNoFrom" to="crNoTo" register={register} errors={errors} empty="blankCrNo" />
          <SelectField label="A/C Period Mth from" options={monthOptions} {...register('monthFrom')} />
          <SelectField label="A/C Period Mth to" options={monthOptions} {...register('monthTo')} />
          <CheckField label="A/C Period Mth is empty" {...register('blankMonth')} />
          <SelectField label="A/C Period Yr from" options={yearOptions} {...register('yearFrom')} />
          <SelectField label="A/C Period Yr to" options={yearOptions} {...register('yearTo')} />
          <CheckField label="A/C Period Yr is empty" {...register('blankYear')} />
          <TextRange label="SUN PV No" from="sunNoFrom" to="sunNoTo" register={register} errors={errors} empty="blankSunNo" />
          <DateRange label="SUN PV Date" from="sunDateFrom" to="sunDateTo" control={control} register={register} empty="blankSunDate" />
        </fieldset>
        <ActionBar label="Payment to member enquiry actions">
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
          <Stat label="Records" value={payments.length} />
          <Stat label="Pay2MBM Amt" value={formatMoney(totalPayable)} />
          <Stat label="Amt Paid" value={formatMoney(totalPaid)} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>
      <Tabs
        label="Payments to members"
        tabs={['Payment To Member', 'Receipts', 'Reissue']}
        panels={[
          <DataGrid
            key="p"
            caption="Payments to members"
            columns={paymentGrid}
            rows={payments}
            rowKey={rowKey}
            tall
            empty="No payments. Scan a claim number or enter the criteria and press Search."
          />,
          <DataGrid key="r" caption="Receipts of the claims" columns={receiptGrid} rows={receipts} rowKey={rowKey} tall empty="No receipts." />,
          <DataGrid key="i" caption="Payments reissued" columns={reissueGrid} rows={reissues} rowKey={rowKey} tall empty="No payments were reissued." />,
        ]}
      />
    </PageShell>
  )
}
