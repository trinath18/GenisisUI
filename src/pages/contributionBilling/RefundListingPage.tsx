// Contribution Billing > Refund Listing (legacy frmMCORefundListing2, "MCO Refund Listing"): the MCO fees refunded to a payor's cancelled or endorsed members, by endorsement effective date or
// endorsement bordx date, and whether a credit note has been printed. Family and household principals are followed by their supplementary members. Read only: "Print CR Note", which writes credit
// note numbers, is not part of this screen.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, SelectField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange } from '../worksheet/RangeFields'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import { dateByOptions, dateLabel, printedOptions, refundColumns, refundDefaults, refundParams, refundProblem, refundSchema } from './refundListingRules'
import type { RefundResult, RefundRow, RefundValues } from './refundListingRules'

const money = /Charged|Utilised|Refund/
const numeric = /Days|Month/
const columns: GridColumn<RefundRow>[] = refundColumns.map((c, i) => ({
  key: `c${i}`,
  label: c.label,
  value: c.value,
  align: (money.test(c.label) && !/Date|Days|Month/.test(c.label)) || numeric.test(c.label) ? 'right' : undefined,
}))

export function RefundListingPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RefundResult | null>(null)
  const form = useForm<RefundValues>({ resolver: yupResolver(refundSchema), defaultValues: refundDefaults, mode: 'onTouched' })
  const dateBy = useWatch({ control: form.control, name: 'dateBy' })

  /** cmdSearch_Click: the checks in the desktop's order, then the search. */
  const search = form.handleSubmit(async (v) => {
    const problem = refundProblem(v)
    if (problem) {
      form.setError(problem.field, { message: problem.message })
      return form.setFocus(problem.field)
    }
    setBusy(true)
    try {
      const { data } = await api.get<RefundResult>('/api/contribution-billing/refund-listing', { params: refundParams(v), timeout: 300000 })
      setResult(data)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 members are shown. Narrow the dates to see the rest.', 'info')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  /** cmdPrint_Click (the desktop wrote an Excel sheet). */
  function print() {
    if (!result || result.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('mco-refund-listing.csv', refundColumns, result.rows)
  }

  function clear() {
    form.reset(refundDefaults)
    setResult(null)
  }

  return (
    <PageShell title="MCO Refund Listing" subtitle="MCO fees refunded to the cancelled and endorsed members of a payor.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <SelectField
            label="Date Selection"
            options={dateByOptions}
            error={form.formState.errors.dateBy}
            {...form.register('dateBy', { onChange: () => setResult(null) })}
          />
          <ComboField
            label="Payor"
            options={lookups.payors}
            error={form.formState.errors.payor}
            {...form.register('payor', { onChange: () => setResult(null) })}
          />
          <DateRange label={dateLabel(dateBy)} from="dateFrom" to="dateTo" control={form.control} register={form.register} />
          <SelectField label="Print Status" blank={false} options={printedOptions} {...form.register('printed', { onChange: () => setResult(null) })} />
        </fieldset>
      </form>

      <DataGrid
        caption="MCO refund"
        columns={columns}
        rows={result?.rows ?? []}
        rowKey={(r) => `${r.kind}|${r.memberNo}|${r.coverId}|${r.endtEffDate}|${r.mcoFee}`}
        tall
        empty="No members. Choose the criteria and press Search."
      />

      <ActionBar label="Refund listing actions">
        <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Searching…">
          Search
        </Button>
        <Button variant="ghost" onClick={print} disabled={!result || result.rows.length === 0}>
          Print
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Total Principal" value={result?.principals ?? 0} />
        <Stat label="Total Supp" value={result?.supplementary ?? 0} />
        <Stat label="Total MCO Refund" value={formatMoney(result?.totalRefund ?? 0)} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
