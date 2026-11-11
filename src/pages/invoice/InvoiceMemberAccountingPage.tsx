// Invoice > Invoice MBM Accounting (legacy FrmInvoiceMBMAC, "Member Invoice Accounting"): the worksheets with an amount payable to the member, by invoice, searched by the
// worksheet's close date, payor, bordx date and batch. Print to File gives the listed invoices the day's next batch, marks them as printed and downloads the list; Preview
// downloads it without marking anything; Update gives the ticked worksheets' member-paid invoices their accounting month and year.

import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, SearchLayout, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoToDmy } from '../case/caseShared'
import { DateRange, NumberRange } from '../worksheet/RangeFields'
import {
  bracketMoney,
  creditText,
  debitText,
  memberDefaults,
  memberParams,
  memberSchema,
  nothingListed,
  periodMonthOptions,
  periodProblem,
  periodRequest,
  periodYearOptions,
  printStatusOptions,
  totalPayable,
  updateQuestion,
} from './invoiceAccountingRules'
import type { MemberAccountingRow, MemberFilterValues } from './invoiceAccountingRules'
import { useAccountingList } from './useAccountingList'

const money = (n: number | null) => (n == null ? '' : formatMoney(n))

const columns: GridColumn<MemberAccountingRow>[] = [
  { key: 'payTo', label: 'Pay To', value: (r) => r.payTo || 'Empty' },
  { key: 'wksNo', label: 'Wsk No', value: (r) => `${r.caseNo}-${r.version}` },
  { key: 'claimCloseDate', label: 'Claim Reg Date', value: (r) => isoToDmy(r.claimCloseDate), sortBy: (r) => r.claimCloseDate ?? '' },
  { key: 'debitCreditRefNo', label: 'Main DCN' },
  { key: 'bordxNo', label: 'Bordx No' },
  { key: 'memberNo', label: 'Mem No' },
  { key: 'memberName', label: 'Mem Name' },
  { key: 'patientName', label: 'Patient Name' },
  { key: 'payable', label: 'Pay2MBM', align: 'right', value: (r) => money(r.payable), sortBy: (r) => r.payable ?? 0 },
  { key: 'previousAmount', label: 'Prev Amt', align: 'right', value: (r) => bracketMoney(r.previousAmount), sortBy: (r) => r.previousAmount ?? 0 },
  { key: 'debit', label: 'DR', align: 'right', value: debitText, sortBy: (r) => r.debit ?? 0 },
  { key: 'credit', label: 'CR', align: 'right', value: creditText, sortBy: (r) => r.credit ?? 0 },
  { key: 'batchDate', label: 'Date Seq' },
  { key: 'batchNo', label: 'Bat No' },
  { key: 'planCode', label: 'PLN Code' },
]

const exportColumns: CsvColumn<MemberAccountingRow>[] = columns.map((c) => ({
  label: c.label,
  value: (r) => (c.value ? c.value(r) : (r[c.key as keyof MemberAccountingRow] as string | null)),
}))

/** The print marks the member-paid invoices only; a hospital-paid invoice of the list stays as it was. */
const memberPaid = (r: MemberAccountingRow) => r.payToCode === 'M'

const thisYear = new Date().getFullYear()
const years = periodYearOptions(thisYear)

export function InvoiceMemberAccountingPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    setError,
    setFocus,
    trigger,
    formState: { errors },
  } = useForm<MemberFilterValues>({
    resolver: yupResolver(memberSchema),
    defaultValues: memberDefaults,
    mode: 'onTouched',
  })
  const payors = useQuery({
    queryKey: ['invoice-member-accounting-payors'],
    queryFn: async () => (await api.get<{ code: string; name: string | null }[]>('/api/invoice/member-accounting/payors')).data,
    staleTime: Infinity,
  })
  const accounting = useAccountingList<MemberAccountingRow>('/api/invoice/member-accounting', 'member-invoices', exportColumns, memberPaid)
  const { list, busy, batch } = accounting
  const pair = { register, errors }
  const payorOptions = (payors.data ?? []).map((p) => {
    const text = p.name ? `${p.code} - ${p.name}` : p.code
    return { value: text, label: text }
  })

  const search = handleSubmit((v) => accounting.search(memberParams(v)))

  /** Preview and Print to File need something listed and valid criteria. */
  async function withCriteria(action: (v: MemberFilterValues) => void | Promise<void>) {
    if (list.rows.length === 0) return notify(nothingListed, 'error')
    if (await trigger()) await action(getValues())
  }

  /** cmdUpdate_Click: the checks, then the question, then the ticked worksheets get the month and year; the list is searched again. */
  async function update() {
    const v = getValues()
    const problem = periodProblem(v, list.rows.length, list.ticked.length)
    if (problem) {
      if (problem.field) {
        setError(problem.field, { message: problem.message })
        setFocus(problem.field)
      }
      return notify(problem.message, 'error')
    }
    if (!(await ask(updateQuestion))) return
    try {
      const { data } = await api.post<{ message: string }>('/api/invoice/member-accounting/period', periodRequest(v, list.ticked))
      notify(data.message, 'success')
      await accounting.search(memberParams(v))
    } catch (e) {
      notify(errorMessage(e), 'error')
    }
  }

  function clear() {
    reset(memberDefaults)
    accounting.clear()
  }

  return (
    <PageShell
      title="Invoice MBM Accounting"
      subtitle="Worksheets payable to members: list them, give them the day's batch, download the file or set their accounting period."
    >
      <form onSubmit={search} noValidate className="screen-form">
        <SearchLayout
          panel={
            <>
              <div className="ct-pair">
                <DateRange label="Claim Date" from="closeDateFrom" to="closeDateTo" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange label="Bordx Date" from="bordxDateFrom" to="bordxDateTo" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange
                  label="Batch Date"
                  from="batchDateFrom"
                  to="batchDateTo"
                  control={control}
                  register={register}
                  hint="The day in the batch, for example M23102026."
                />
              </div>
              <div className="ct-pair">
                <NumberRange label="Batch No" from="batchNoFrom" to="batchNoTo" {...pair} />
              </div>
            </>
          }
        >
          <fieldset>
            <legend>Selection Criteria</legend>
            <SelectField label="Print Status" required blank={false} options={printStatusOptions} error={errors.printStatus} {...register('printStatus')} />
            <ComboField label="Payor" options={payorOptions} {...register('payor')} />
          </fieldset>

          <fieldset>
            <legend>For Update A/C Period</legend>
            <SelectField label="A/C Period Mth" options={periodMonthOptions} error={errors.periodMonth} {...register('periodMonth')} />
            <SelectField label="A/C Period Yr" options={years} error={errors.periodYear} {...register('periodYear')} />
          </fieldset>

          <ActionBar label="Invoice MBM accounting actions">
            <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
              Search
            </Button>
            <Button variant="ghost" onClick={() => withCriteria(() => accounting.preview())} disabled={busy}>
              Preview
            </Button>
            <Button variant="ghost" onClick={() => withCriteria((v) => accounting.print(memberParams(v)))} disabled={busy}>
              Print to File
            </Button>
            <Button variant="ghost" onClick={update} disabled={busy}>
              Update
            </Button>
            <Button variant="link" onClick={clear}>
              Clear
            </Button>
            <span className="spacer" />
            <Stat label="Records" value={list.rows.length} />
            <Stat label="Selected" value={list.checked.size} />
            <Stat label="Total Amt" value={formatMoney(totalPayable(list.rows))} />
            <Stat label="Seq No" value={batch} />
            <Button variant="link" onClick={() => navigate('/')}>
              Exit
            </Button>
          </ActionBar>

          <DataGrid
            caption="Invoices of worksheets payable to members"
            columns={columns}
            rows={list.rows}
            rowKey={(r) => r.key}
            check={{ checked: list.checked, onChange: list.change }}
            tall
            empty="No invoices. Enter the search criteria and press Search."
          />
        </SearchLayout>
      </form>
    </PageShell>
  )
}
