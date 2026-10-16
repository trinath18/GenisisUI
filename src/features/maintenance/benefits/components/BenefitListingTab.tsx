import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { benefitsApi } from '../api/benefitsApi'
import { formatDate } from '../../../../lib/format'
import type { AmountsForm, Option } from '../benefitLookups'
import { amountsBody, emptyAmounts, optionLabel, useBenefitLookups, withProduct } from '../benefitLookups'

interface BenefitRow {
  subCategoryCode: string
  subCategoryName: string | null
  healthCode: string
  insuredCode: string
  planCode: string
  days: number | null
  ratePerDay: string | null
  perDisability: string | null
  effectiveDate: string
  payorCode: string | null
  groupCompany: string | null
}

const emptyForm = {
  subCategoryCode: '',
  healthCode: '',
  insuredCode: '',
  planCode: '',
  effectiveDate: '',
  payorCode: '',
  groupCompany: '',
  ...emptyAmounts,
}
type Form = typeof emptyForm

const rowKey = (r: Pick<BenefitRow, 'subCategoryCode' | 'insuredCode' | 'planCode' | 'effectiveDate'>) =>
  `${r.subCategoryCode}|${r.insuredCode}|${r.planCode}|${r.effectiveDate.slice(0, 10)}`

/** Benefits Listing tab: search benefit rows; add a single row, or edit / delete one. A row's sub category, insured type,
 * plan and effective date identify it, so Edit changes only Days/Months, RM / Day and RM Per Disability. */
export function BenefitListingTab() {
  const queryClient = useQueryClient()
  const lookups = useBenefitLookups()
  const [form, setForm] = useState<Form>(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState<{ form: Form; n: number } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const search = useQuery({
    queryKey: ['benefit-rows', filter],
    enabled: filter !== null,
    queryFn: async () => {
      const f = filter!.form
      const params = {
        subCategoryCode: f.subCategoryCode || undefined,
        healthCode: f.healthCode || undefined,
        insuredCode: f.insuredCode || undefined,
        planCode: f.planCode.trim() || undefined,
        effectiveDate: f.effectiveDate || undefined,
        payorCode: f.payorCode || undefined,
        groupCompany: f.groupCompany.trim() || undefined,
      }
      return benefitsApi.searchRows<{ rows: BenefitRow[]; truncated: boolean; limit: number }>(params)
    },
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['benefit-rows'] })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        subCategoryCode: form.subCategoryCode,
        healthCode: form.healthCode,
        insuredCode: form.insuredCode,
        planCode: form.planCode,
        effectiveDate: form.effectiveDate || null,
        ...amountsBody(form),
      }
      return benefitsApi.saveRow(editing === null, body)
    },
    onSuccess: () => {
      setDone(editing === null ? 'Record Saved...' : 'Record Updated...')
      if (filter === null) setFilter({ form: { ...emptyForm, planCode: form.planCode, insuredCode: form.insuredCode }, n: 0 })
      clear()
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: async (r: BenefitRow) =>
      benefitsApi.deleteRow({ subCategoryCode: r.subCategoryCode, insuredCode: r.insuredCode, planCode: r.planCode, effectiveDate: r.effectiveDate.slice(0, 10) }),
    onSuccess: (_, r) => {
      setDone('Record Deleted...')
      if (editing === rowKey(r)) clear()
      refresh()
    },
  })
  const busy = save.isPending || remove.isPending

  const resetFeedback = () => {
    setDone(null)
    if (!save.isPending) save.reset()
    if (!remove.isPending) remove.reset()
  }
  const clear = () => {
    setForm(emptyForm)
    setEditing(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save this record?')) save.mutate()
  }
  const onEdit = (r: BenefitRow) => {
    resetFeedback()
    setEditing(rowKey(r))
    setForm({
      ...emptyForm,
      subCategoryCode: r.subCategoryCode,
      healthCode: r.healthCode,
      insuredCode: r.insuredCode,
      planCode: r.planCode,
      effectiveDate: r.effectiveDate.slice(0, 10),
      days: r.days?.toString() ?? '',
      ratePerDay: r.ratePerDay ?? '',
      perDisability: r.perDisability ?? '',
    })
  }
  const setAmount = (field: keyof AmountsForm, value: string) => {
    const next = { ...form, [field]: value }
    setForm(field === 'perDisability' ? next : { ...next, ...withProduct(next) })
  }
  const select = (field: keyof Form, label: string, options: Option[] | undefined, keyField = true) => (
    <label className="form-field">
      <span>{label}{keyField && ' *'}</span>
      <select value={form[field]} disabled={busy || (keyField && editing !== null)} onChange={(e) => setForm({ ...form, [field]: e.target.value })}>
        <option value="" />
        {form[field] && !options?.some((o) => o.code === form[field]) && <option value={form[field]}>{form[field]}</option>}
        {options?.map((o) => (
          <option key={o.code} value={o.code}>{optionLabel(o)}</option>
        ))}
      </select>
    </label>
  )

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          {select('healthCode', 'Health Type', lookups.data?.healthTypes)}
          {select('insuredCode', 'Insured Type', lookups.data?.insuredTypes)}
          <label className="form-field">
            <span>Plan Code *</span>
            <input value={form.planCode} maxLength={4} disabled={busy || editing !== null}
              onChange={(e) => setForm({ ...form, planCode: e.target.value.toUpperCase() })} />
          </label>
          {select('subCategoryCode', 'Sub Cat Code', lookups.data?.subCategories)}
          <label className="form-field">
            <span>Eff Date *</span>
            <input type="date" value={form.effectiveDate} disabled={busy || editing !== null}
              onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
          </label>
          <label className="form-field">
            <span>No of Days</span>
            <input type="number" min={0} step={1} value={form.days} disabled={busy} onChange={(e) => setAmount('days', e.target.value)} />
          </label>
          <label className="form-field">
            <span>RM / Day</span>
            <input value={form.ratePerDay} maxLength={15} disabled={busy} onChange={(e) => setAmount('ratePerDay', e.target.value)} />
          </label>
          <label className="form-field">
            <span>RM Per Disability *</span>
            <input value={form.perDisability} maxLength={50} disabled={busy} onChange={(e) => setAmount('perDisability', e.target.value)} />
          </label>
        </fieldset>
        <fieldset>
          <legend>Search only</legend>
          {select('payorCode', 'Payor Code', lookups.data?.payors, false)}
          <label className="form-field">
            <span>Group Company</span>
            <input list="benefit-group-companies" value={form.groupCompany} disabled={busy || editing !== null}
              onChange={(e) => setForm({ ...form, groupCompany: e.target.value })} />
            <datalist id="benefit-group-companies">
              {lookups.data?.groupCompanies.map((g) => <option key={g} value={g} />)}
            </datalist>
          </label>
        </fieldset>
        {lookups.isError && <p className="error">{errorMessage(lookups.error)}</p>}
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
        {done && <p className="success">{done}</p>}
        <div className="actions">
          <button type="submit" disabled={busy}>{editing === null ? 'Save' : 'Update'}</button>
          <button type="button" disabled={busy || editing !== null}
            onClick={() => { resetFeedback(); setFilter((f) => ({ form, n: (f?.n ?? 0) + 1 })) }}>
            Search
          </button>
          <button type="button" disabled={busy} onClick={() => { resetFeedback(); clear() }}>Clear</button>
        </div>
      </form>

      {search.isError && <p className="error">{errorMessage(search.error)}</p>}
      {search.data && (
        <>
          <p className="muted">
            Total records: {search.data.rows.length}
            {search.data.truncated && ` (first ${search.data.limit} shown, narrow the search)`}
          </p>
          {search.data.rows.length === 0 ? (
            <p className="muted">Record not found</p>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="center">Sub Cat. Code</th>
                    <th>Sub Cat. Description</th>
                    <th className="center">Insured Type</th>
                    <th className="center">Plan Code</th>
                    <th className="center">Health Type</th>
                    <th className="num">Days/Months</th>
                    <th className="num">RM/Day</th>
                    <th className="num">RM Per Disability</th>
                    <th>Eff Date</th>
                    <th className="center">Payor Code</th>
                    <th>Group Company</th>
                    <th className="action-cell" />
                  </tr>
                </thead>
                <tbody>
                  {search.data.rows.map((r) => (
                    <tr key={rowKey(r)} className={editing === rowKey(r) ? 'selected' : undefined}>
                      <td className="center">{r.subCategoryCode}</td>
                      <td>{r.subCategoryName}</td>
                      <td className="center">{r.insuredCode}</td>
                      <td className="center">{r.planCode}</td>
                      <td className="center">{r.healthCode}</td>
                      <td className="num">{r.days}</td>
                      <td className="num">{r.ratePerDay}</td>
                      <td className="num">{r.perDisability}</td>
                      <td>{formatDate(r.effectiveDate)}</td>
                      <td className="center">{r.payorCode}</td>
                      <td>{r.groupCompany}</td>
                      <td className="action-cell">
                        <button type="button" className="link" disabled={busy} onClick={() => onEdit(r)}>Edit</button>
                        <button type="button" className="link" disabled={busy}
                          onClick={() => window.confirm('Do you want to delete this record?') && (resetFeedback(), remove.mutate(r))}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
