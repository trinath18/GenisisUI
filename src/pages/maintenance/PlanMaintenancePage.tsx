import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'

interface Option {
  code: string
  name: string
}
interface Lookups {
  healthCodes: Option[]
  payors: Option[]
  productCategories: Option[]
  policyWordings: string[]
  maxPlans: number
}
interface PlanRow {
  index: number
  healthCode: string
  code: string
  description: string | null
  payorCode: string | null
  groupCompany: string | null
  productCategory: string | null
  effectiveDate: string | null
  annualLimitInd: string | null
  premiumInd: string | null
  mcoInd: string | null
  policyWording: string | null
  clientPlan: string | null
}
interface SearchResult {
  rows: PlanRow[]
  truncated: boolean
  limit: number
}
interface CreatedPlan {
  index: number
  code: string
  description: string | null
}

const yesNo = [
  ['annualLimitInd', 'Annual Limit Ind.'],
  ['lifetimeStatus', 'Life Time Status'],
  ['premiumInd', 'Premium Ind.'],
  ['mcoInd', 'MCO Ind.'],
  ['topUpStatus', 'Topup Status'],
  ['specialGracePeriod', 'Special GPeriod'],
  ['coPayment', 'Co-Payment'],
  ['meal', 'Meals'],
  ['nursing', 'Nursing Charges'],
  ['tax', 'Tax'],
  ['mri', 'MRI'],
  ['sof', 'SOF'],
  ['smPlan', 'New SM Plan'],
  ['managementFee', 'Mgmt. Fee'],
  ['disIndicator', 'Dis. Indicator'],
] as const

type Form = Record<string, string>
const emptyLines = () => Array.from({ length: 6 }, () => ({ code: '', description: '' }))

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function PlanMaintenancePage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Form>({})
  const [lines, setLines] = useState(emptyLines)
  const [filter, setFilter] = useState<Form | null>(null)
  const [created, setCreated] = useState<CreatedPlan[] | null>(null)
  const set = (key: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const lookups = useQuery({ queryKey: ['plan-lookups'], queryFn: async () => (await api.get<Lookups>('/api/maintenance/plans/lookups')).data })
  const clientPlans = useQuery({
    queryKey: ['client-plans', form.payorCode ?? ''],
    queryFn: async () => (await api.get<string[]>('/api/maintenance/plans/client-plans', { params: { payorCode: form.payorCode } })).data,
  })
  const search = useQuery({
    queryKey: ['plans', filter],
    enabled: filter !== null,
    queryFn: async () => (await api.get<SearchResult>('/api/maintenance/plans', { params: filter })).data,
  })

  const isN = form.healthCode === 'N'
  const isS = form.healthCode === 'S'
  const count = isN ? Number(form.numberOfPlans || 0) : 6

  const save = useMutation({
    mutationFn: async () => {
      const num = (v?: string) => (v ? Number(v) : null)
      const body = {
        ...form,
        numberOfPlans: isN ? num(form.numberOfPlans) : null,
        specialGracePeriodDays: num(form.specialGracePeriodDays),
        startAge: num(form.startAge),
        endAge: num(form.endAge),
        coPayPercent: num(form.coPayPercent),
        effectiveDate: form.effectiveDate || null,
        plans: lines.slice(0, count).map((l) => ({ code: isS ? l.code : null, description: l.description })),
      }
      return (await api.post<CreatedPlan[]>('/api/maintenance/plans', body)).data
    },
    onSuccess: (data) => {
      setCreated(data)
      setForm({})
      setLines(emptyLines())
      queryClient.invalidateQueries({ queryKey: ['plans'] })
    },
  })
  const remove = useMutation({
    mutationFn: async (index: number) => api.delete(`/api/maintenance/plans/${index}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans'] }),
  })

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    setCreated(null)
    if (window.confirm('Do you want to save the record?')) save.mutate()
  }
  const onSearch = () => {
    const f: Form = {}
    for (const k of ['healthCode', 'payorCode', 'groupCompany', 'productCategory', 'topUpStatus', 'coPayment', 'sof', 'specialGracePeriod', 'meal', 'nursing', 'tax', 'mri', 'disIndicator'])
      if (form[k]) f[k] = form[k]
    if (isS && lines[0].code) f.planCode = lines[0].code
    remove.reset()
    setFilter(f)
  }

  const l = lookups.data
  const select = (key: string, options: Option[] | undefined) => (
    <select value={form[key] ?? ''} onChange={set(key)}>
      <option value="" />
      {options?.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code} - {o.name}
        </option>
      ))}
    </select>
  )

  return (
    <section className="registration">
      <h2>Plan Maintenance</h2>
      {lookups.isError && <p className="error">{errorMessage(lookups.error)}</p>}
      <form onSubmit={onSave}>
        <fieldset>
          <legend>Plan</legend>
          <Field label="Health Type *">{select('healthCode', l?.healthCodes)}</Field>
          <Field label={isN ? 'Payor *' : 'Payor'}>{select('payorCode', l?.payors)}</Field>
          <Field label="Group Company *">
            <input value={form.groupCompany ?? ''} maxLength={200} onChange={set('groupCompany')} />
          </Field>
          {isN && (
            <Field label="No of Plan *">
              <select value={form.numberOfPlans ?? ''} onChange={set('numberOfPlans')}>
                <option value="" />
                {Array.from({ length: l?.maxPlans ?? 6 }, (_, i) => (
                  <option key={i + 1}>{i + 1}</option>
                ))}
              </select>
            </Field>
          )}
          {yesNo.map(([key, label]) => (
            <Field key={key} label={label + (key === 'sof' || key === 'smPlan' ? '' : ' *')}>
              <select value={form[key] ?? ''} onChange={set(key)}>
                <option value="" />
                <option value="Y">Y - Yes</option>
                <option value="N">N - No</option>
              </select>
            </Field>
          ))}
          {form.specialGracePeriod === 'Y' && (
            <Field label="Special GPeriod Days *">
              <input type="number" min={0} max={999} value={form.specialGracePeriodDays ?? ''} onChange={set('specialGracePeriodDays')} />
            </Field>
          )}
          <Field label="Effective Date *">
            <input type="date" value={form.effectiveDate ?? ''} onChange={set('effectiveDate')} />
          </Field>
          <Field label="Product Category *">{select('productCategory', l?.productCategories)}</Field>
          <Field label="Policy Start Age *">
            <input type="number" min={0} max={99} value={form.startAge ?? ''} onChange={set('startAge')} />
          </Field>
          <Field label="Policy End Age *">
            <input type="number" min={0} max={999} value={form.endAge ?? ''} onChange={set('endAge')} />
          </Field>
          <Field label="Policy Category *">
            <select value={form.policyWording ?? ''} onChange={set('policyWording')}>
              <option value="" />
              {l?.policyWordings.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </Field>
          {!!clientPlans.data?.length && (
            <Field label="Client Plan">
              <select value={form.clientPlan ?? ''} onChange={set('clientPlan')}>
                <option value="" />
                {clientPlans.data.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Client Policy No">
            <input value={form.clientPolicyNo ?? ''} onChange={set('clientPolicyNo')} />
          </Field>
          <Field label="Co-Pay %">
            <input type="number" min={0} max={100} value={form.coPayPercent ?? ''} onChange={set('coPayPercent')} />
          </Field>
        </fieldset>
        {(isN || isS) && (
          <fieldset>
            <legend>{isN ? 'Plan descriptions (codes are generated)' : 'Plan codes'}</legend>
            {lines.slice(0, count).map((line, i) => (
              <div key={i} className="covered">
                {isS && (
                  <input
                    aria-label={`Plan Code ${i + 1}`}
                    placeholder="Code"
                    maxLength={4}
                    value={line.code}
                    onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
                  />
                )}
                <input
                  aria-label={`Description ${i + 1}`}
                  placeholder="Description"
                  maxLength={200}
                  value={line.description}
                  onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                />
              </div>
            ))}
          </fieldset>
        )}
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {created && (
          <p className="success">
            Record Saved... Plan code{created.length > 1 ? 's' : ''}: {created.map((c) => c.code).join(', ')}
          </p>
        )}
        <div className="actions">
          <button type="submit" disabled={save.isPending}>
            Save
          </button>
          <button type="button" onClick={onSearch}>
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({})
              setLines(emptyLines())
              setCreated(null)
              save.reset()
              remove.reset()
            }}
          >
            Clear
          </button>
        </div>
      </form>
      {search.isError && <p className="error">{errorMessage(search.error)}</p>}
      {remove.isError && <p className="error">{errorMessage(remove.error)}</p>}
      {search.data && (
        <>
          <p className="muted">
            {search.data.rows.length === 0 ? 'Record not found' : `${search.data.rows.length} record(s)`}
            {search.data.truncated && ` (showing the latest ${search.data.limit}; narrow the search to see more)`}
          </p>
          <table>
            <thead>
              <tr>
                <th>Health</th>
                <th>Plan</th>
                <th>Description</th>
                <th>Payor</th>
                <th>Group Company</th>
                <th>Prod. Cat.</th>
                <th>Effective</th>
                <th>Ann/Prm/MCO</th>
                <th>Client Plan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {search.data.rows.map((r) => (
                <tr key={r.index}>
                  <td>{r.healthCode}</td>
                  <td>{r.code}</td>
                  <td>{r.description}</td>
                  <td>{r.payorCode}</td>
                  <td>{r.groupCompany}</td>
                  <td>{r.productCategory}</td>
                  <td>{r.effectiveDate?.slice(0, 10)}</td>
                  <td>
                    {r.annualLimitInd}/{r.premiumInd}/{r.mcoInd}
                  </td>
                  <td>{r.clientPlan}</td>
                  <td>
                    <button
                      type="button"
                      className="link"
                      disabled={remove.isPending}
                      onClick={() => window.confirm(`Do you want to delete plan ${r.code}?`) && remove.mutate(r.index)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
