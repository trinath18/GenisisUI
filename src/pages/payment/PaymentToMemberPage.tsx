// Payment > To Member > Pay2MBM and Pay2MBM(Auto) (legacy FrmPayMember and frmPayMemberJul08; rebuilt, their sources are missing): search the claims, tick them (Check All ticks every one), click a
// claim to change its payee, bank or account, then Generate PV (one voucher per claim) or Void (close the claims without paying the member). The vouchers written are listed and can be saved to a file.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, DateField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import type { CsvColumn } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { useTickList } from '../worksheet/useTickList'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import { modeOptions } from './paymentToHospitalRules'
import {
  claimColumns,
  confirmText,
  generateProblem,
  payeeOf,
  pvBody,
  pvDefaults,
  pvSchema,
  rowKey,
  screens,
  searchDefaults,
  searchParams,
  searchSchema,
  voidBody,
  voidText,
  voucherColumns,
} from './paymentToMemberRules'
import type { MemberClaim, MemberVoucher, Payee, PvValues, SearchResult, SearchValues, Source } from './paymentToMemberRules'

const base = '/api/payment/to-member'
const grid = <T extends object>(cols: (CsvColumn<T> & { right?: boolean })[]): GridColumn<T>[] =>
  cols.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: c.right ? 'right' : undefined }))
const voucherGrid = grid(voucherColumns)

export function PaymentToMemberPage({ source }: { source: Source }) {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const screen = screens[source]
  const [busy, setBusy] = useState(false)
  const [vouchers, setVouchers] = useState<MemberVoucher[]>([])
  const [payees, setPayees] = useState<Map<string, Payee>>(new Map())
  const [selected, setSelected] = useState<MemberClaim | null>(null)
  const list = useTickList<MemberClaim>(rowKey)
  const form = useForm<SearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const pv = useForm<PvValues>({ resolver: yupResolver(pvSchema), defaultValues: pvDefaults(), mode: 'onTouched' })
  const mode = useWatch({ control: pv.control, name: 'paymentMode' })
  const tickedTotal = list.ticked.reduce((s, r) => s + (r.amount ?? 0), 0)
  const payee = selected ? payeeOf(selected, payees) : null

  async function run(work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const search = form.handleSubmit((values) =>
    run(async () => {
      const { data } = await api.get<SearchResult>(base, { params: searchParams(source, values), timeout: 300000 })
      list.replace(data.rows)
      setSelected(null)
      if (data.count === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 claims are shown. Narrow the search to see the rest.', 'info')
    }),
  )

  function done(keys: Set<string>) {
    list.replace(list.rows.filter((r) => !keys.has(rowKey(r))))
    setSelected(null)
  }

  const generate = pv.handleSubmit(async (values) => {
    const problem = generateProblem(list.ticked, payees)
    if (problem) return notify(problem, 'error')
    if (!(await ask(confirmText(list.ticked, values)))) return
    await run(async () => {
      const { data } = await api.post<{ vouchers: MemberVoucher[] }>(`${base}/vouchers`, pvBody(source, values, list.ticked, payees))
      setVouchers(data.vouchers)
      notify(`${data.vouchers.length} PV(s) generated.`, 'success')
      done(new Set(list.ticked.map(rowKey)))
    })
  })

  const voidClaims = pv.handleSubmit(async (values) => {
    if (list.ticked.length === 0) return notify('Please select the claims to void.', 'error')
    if (!(await ask(voidText(list.ticked)))) return
    await run(async () => {
      const { data } = await api.post<{ count: number }>(`${base}/void`, voidBody(source, values, list.ticked))
      notify(`${data.count} claim(s) voided.`, 'success')
      done(new Set(list.ticked.map(rowKey)))
    })
  })

  function editPayee(field: keyof Payee, value: string) {
    if (!selected || !payee) return
    setPayees(new Map(payees).set(rowKey(selected), { ...payee, [field]: value }))
  }

  const checkAll = () => list.change(new Set(list.rows.map(rowKey)))

  return (
    <PageShell title={screen.title} subtitle={screen.subtitle}>
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>{screen.legend}</legend>
          <ComboField label="Payor" options={lookups.payors} {...form.register('payor')} />
          <TextField label="Mem No" {...form.register('memberNo')} />
          <TextField label="Mem Name" {...form.register('memberName')} />
          <TextRange label="Case No" from="caseFrom" to="caseTo" register={form.register} errors={form.formState.errors} />
          <TextRange label="D/N No" from="noteFrom" to="noteTo" register={form.register} errors={form.formState.errors} />
          <DateRange label="Close Date" from="closeFrom" to="closeTo" control={form.control} register={form.register} />
        </fieldset>
        <ActionBar label="Search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button variant="ghost" onClick={checkAll} disabled={busy || list.rows.length === 0}>
            Check All
          </Button>
          <span className="spacer" />
          <Stat label="Claims" value={list.rows.length} />
          <Stat label="Ticked" value={list.ticked.length} />
          <Stat label="Ticked Amt" value={formatMoney(tickedTotal)} />
        </ActionBar>
      </form>

      <DataGrid
        caption={screen.legend}
        columns={grid(claimColumns(source, payees))}
        rows={list.rows}
        rowKey={rowKey}
        check={{ checked: list.checked, onChange: list.change }}
        selectedKey={selected ? rowKey(selected) : null}
        onSelect={setSelected}
        tall
        empty={screen.empty}
      />

      {selected && payee && (
        <fieldset className="screen-form">
          <legend>
            Payee of claim {selected.caseNo}-{selected.claimVersion}
          </legend>
          <TextField label="Pay To" wide maxLength={120} value={payee.payTo} onChange={(e) => editPayee('payTo', e.target.value)} />
          <TextField label="Bank" maxLength={200} value={payee.bank} onChange={(e) => editPayee('bank', e.target.value)} />
          <TextField label="Account No" maxLength={60} value={payee.account} onChange={(e) => editPayee('account', e.target.value)} />
        </fieldset>
      )}

      <form onSubmit={(e: FormEvent) => void generate(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Payment voucher</legend>
          <DateField control={pv.control} name="pvDate" label="PV Date" required />
          <SelectField label="Payment Mode" blank={false} options={modeOptions} {...pv.register('paymentMode')} />
          {mode === 'CHEQUE' && <TextField label="First Cheque No" maxLength={40} error={pv.formState.errors.chequeNo} {...pv.register('chequeNo')} />}
          <TextField label="Remark" wide maxLength={400} error={pv.formState.errors.remark} {...pv.register('remark')} />
        </fieldset>
        <ActionBar label="Payment voucher actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Generating…">
            Generate PV
          </Button>
          <Button variant="ghost" onClick={() => void voidClaims()} disabled={busy}>
            Void
          </Button>
          <Button
            variant="ghost"
            onClick={() => (vouchers.length ? downloadCsv('payment-to-member.csv', voucherColumns, vouchers) : notify('No PV has been generated.', 'info'))}
          >
            Print to File
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>

      {vouchers.length > 0 && <DataGrid caption="Vouchers generated" columns={voucherGrid} rows={vouchers} rowKey={(v) => v.pvNo} />}
    </PageShell>
  )
}
