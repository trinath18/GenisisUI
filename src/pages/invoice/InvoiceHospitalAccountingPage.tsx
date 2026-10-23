// Invoice > Invoice HOS Accounting (legacy FrmInvoiceHOSAC, "Invoice Hospital Accounting"): the invoices paid to hospitals that were not handed to accounts yet (or were:
// "R - Reprint"), searched by invoice and registration date, hospital and batch. Print to File gives the listed invoices the day's next batch, marks them as printed and
// downloads the list; Preview downloads it without marking anything.

import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, SearchLayout, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api } from '../../api/client'
import { isoToDmy } from '../case/caseShared'
import { DateRange, NumberRange } from '../worksheet/RangeFields'
import {
  bracketMoney,
  creditText,
  debitText,
  hospitalDefaults,
  hospitalParams,
  hospitalSchema,
  nothingListed,
  printStatusOptions,
  totalPayable,
} from './invoiceAccountingRules'
import type { HospitalAccountingRow, HospitalFilterValues } from './invoiceAccountingRules'
import { useAccountingList } from './useAccountingList'

const money = (n: number | null) => (n == null ? '' : formatMoney(n))

const columns: GridColumn<HospitalAccountingRow>[] = [
  { key: 'hospitalCode', label: 'Hospital', value: (r) => r.hospitalCode || 'Empty' },
  { key: 'invoiceNo', label: 'Inv No' },
  { key: 'invoiceDate', label: 'Inv Date', value: (r) => isoToDmy(r.invoiceDate), sortBy: (r) => r.invoiceDate ?? '' },
  { key: 'registeredDate', label: 'Inv Reg Date', value: (r) => isoToDmy(r.registeredDate), sortBy: (r) => r.registeredDate ?? '' },
  { key: 'wksNo', label: 'Worksheet No', value: (r) => `${r.caseNo}-${r.version}` },
  { key: 'bordxNo', label: 'Bordx No' },
  { key: 'memberNo', label: 'Member No' },
  { key: 'memberName', label: 'Member Name' },
  { key: 'patientName', label: 'Patient Name' },
  { key: 'payable', label: 'Pay2HOS', align: 'right', value: (r) => money(r.payable), sortBy: (r) => r.payable ?? 0 },
  { key: 'previousAmount', label: 'Previous Amt', align: 'right', value: (r) => bracketMoney(r.previousAmount), sortBy: (r) => r.previousAmount ?? 0 },
  { key: 'debit', label: 'DR', align: 'right', value: debitText, sortBy: (r) => r.debit ?? 0 },
  { key: 'credit', label: 'CR', align: 'right', value: creditText, sortBy: (r) => r.credit ?? 0 },
  { key: 'batchDate', label: 'Date Seq' },
  { key: 'batchNo', label: 'Bat No' },
]

const exportColumns: CsvColumn<HospitalAccountingRow>[] = columns.map((c) => ({
  label: c.label,
  value: (r) => (c.value ? c.value(r) : (r[c.key as keyof HospitalAccountingRow] as string | null)),
}))

export function InvoiceHospitalAccountingPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    reset,
    control,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<HospitalFilterValues>({
    resolver: yupResolver(hospitalSchema),
    defaultValues: hospitalDefaults,
    mode: 'onTouched',
  })
  const hospitals = useQuery({
    queryKey: ['invoice-hospital-accounting-hospitals'],
    queryFn: async () => (await api.get<{ code: string; name: string | null }[]>('/api/invoice/hospital-accounting/hospitals')).data,
    staleTime: Infinity,
  })
  const accounting = useAccountingList<HospitalAccountingRow>('/api/invoice/hospital-accounting', 'hospital-invoices', exportColumns)
  const { list, busy, batch } = accounting
  const printStatus = useWatch({ control, name: 'printStatus' })
  const pair = { register, errors }

  const search = handleSubmit((v) => accounting.search(hospitalParams(v)))

  /** Preview and Print to File need the criteria to be valid and something listed (the list is checked first, as the desktop's buttons did). */
  async function withCriteria(action: (v: HospitalFilterValues) => void | Promise<void>) {
    if (list.rows.length === 0) return notify(nothingListed, 'error')
    if (await trigger()) await action(getValues())
  }

  function clear() {
    reset(hospitalDefaults)
    accounting.clear()
  }

  return (
    <PageShell title="Invoice HOS Accounting" subtitle="Invoices paid to hospitals: list them, give them the day's batch and download the file.">
      <form onSubmit={search} noValidate className="screen-form">
        <SearchLayout
          panel={
            <>
              <div className="ct-pair">
                <DateRange label="Inv Date" from="invoiceDateFrom" to="invoiceDateTo" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange label="Inv Reg Date" from="registeredFrom" to="registeredTo" control={control} register={register} />
              </div>
              <div className="ct-pair">
                <DateRange
                  label="Batch Date"
                  from="batchDateFrom"
                  to="batchDateTo"
                  control={control}
                  register={register}
                  hint="The day in the batch, for example H23102026."
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
            <SelectField
              label="Hospital"
              options={(hospitals.data ?? []).map((h) => ({ value: h.code, label: h.name ?? h.code }))}
              {...register('hospitalCode')}
            />
          </fieldset>

          <ActionBar label="Invoice HOS accounting actions">
            <Button variant="primary" type="submit" busy={busy} busyLabel="Working…">
              Search
            </Button>
            <Button variant="ghost" onClick={() => withCriteria(() => accounting.preview())} disabled={busy}>
              Preview
            </Button>
            <Button variant="ghost" onClick={() => withCriteria((v) => accounting.print(hospitalParams(v)))} disabled={busy}>
              Print to File
            </Button>
            <Button variant="link" onClick={clear}>
              Clear
            </Button>
            <span className="spacer" />
            <Stat label="Records" value={list.rows.length} />
            <Stat label="Total Amt" value={formatMoney(totalPayable(list.rows))} />
            <Stat label="Seq No" value={batch || (printStatus === 'N' ? '' : '–')} />
            <Button variant="link" onClick={() => navigate('/')}>
              Exit
            </Button>
          </ActionBar>

          <DataGrid
            caption="Invoices paid to hospitals"
            columns={columns}
            rows={list.rows}
            rowKey={(r) => r.key}
            tall
            empty="No invoices. Enter the search criteria and press Search."
          />
        </SearchLayout>
      </form>
    </PageShell>
  )
}
