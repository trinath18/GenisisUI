import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { benefitsApi } from '../api/benefitsApi'
import type { AmountsForm } from '../benefitLookups'
import { amountsBody, emptyAmounts, optionLabel, useBenefitLookups, withProduct } from '../benefitLookups'
import { Button } from '../../../../components/Button'

interface EntryLine {
  code: string
  name: string | null
  days: number | null
  ratePerDay: string | null
  perDisability: string | null
}

interface Key {
  healthCode: string
  insuredCode: string
  planCode: string
  effectiveDate: string
}

const emptyKey: Key = { healthCode: '', insuredCode: '', planCode: '', effectiveDate: '' }
const sameKey = (a: Key, b: Key) =>
  a.healthCode === b.healthCode && a.insuredCode === b.insuredCode && a.planCode === b.planCode && a.effectiveDate === b.effectiveDate

/** Benefit Entry tab: enter a benefit set for a plan / insured / health / date, one line per sub category.
 * Lines with an RM per disability are saved. An existing set is changed on the Benefits Listing tab. */
export function BenefitEntryTab() {
  const lookups = useBenefitLookups()
  const [key, setKey] = useState<Key>(emptyKey)
  const [amounts, setAmounts] = useState<Record<string, AmountsForm>>({})
  const [loaded, setLoaded] = useState<{ key: Key; setExists: boolean; names: Record<string, string | null> } | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = useMutation({
    mutationFn: async (k: Key) =>
      benefitsApi.loadEntry<{ lines: EntryLine[]; setExists: boolean }>({
        healthCode: k.healthCode || undefined,
        insuredCode: k.insuredCode || undefined,
        planCode: k.planCode.trim() || undefined,
        effectiveDate: k.effectiveDate || undefined,
      }),
    onSuccess: (data, k) => {
      setAmounts(
        Object.fromEntries(
          data.lines.map((l) => [l.code, { days: l.days?.toString() ?? '', ratePerDay: l.ratePerDay ?? '', perDisability: l.perDisability ?? '' }]),
        ),
      )
      setLoaded({ key: k, setExists: data.setExists, names: Object.fromEntries(data.lines.map((l) => [l.code, l.name])) })
    },
  })
  const save = useMutation({
    mutationFn: async () =>
      benefitsApi.saveEntry({
        ...key,
        effectiveDate: key.effectiveDate || null,
        lines: Object.entries(amounts).map(([code, a]) => ({ subCategoryCode: code, ...amountsBody(a) })),
      }),
    onSuccess: (data) => {
      setDone(`Record Saved... (${data.saved} benefit${data.saved === 1 ? '' : 's'})`)
      load.mutate(key)
    },
  })
  const busy = save.isPending || load.isPending
  const exists = loaded !== null && loaded.setExists && sameKey(loaded.key, key)

  const lines = loaded
    ? Object.entries(loaded.names).map(([code, name]) => ({ code, name }))
    : (lookups.data?.subCategories ?? []).map((s) => ({ code: s.code, name: s.name }))

  const resetFeedback = () => {
    setDone(null)
    if (!save.isPending) save.reset()
    if (!load.isPending) load.reset()
  }
  const clear = () => {
    setKey(emptyKey)
    setAmounts({})
    setLoaded(null)
  }
  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    resetFeedback()
    if (window.confirm('Do you want to save this record?')) save.mutate()
  }
  const setAmount = (code: string, field: keyof AmountsForm, value: string) => {
    const next = { ...(amounts[code] ?? emptyAmounts), [field]: value }
    setAmounts({ ...amounts, [code]: field === 'perDisability' ? next : withProduct(next) })
  }
  const select = (field: 'healthCode' | 'insuredCode', label: string, options = lookups.data?.healthTypes) => (
    <label className="form-field">
      <span>{label} *</span>
      <select value={key[field]} disabled={busy} onChange={(e) => setKey({ ...key, [field]: e.target.value })}>
        <option value="" />
        {options?.map((o) => (
          <option key={o.code} value={o.code}>
            {optionLabel(o)}
          </option>
        ))}
      </select>
    </label>
  )
  const cell = (code: string, field: keyof AmountsForm, props: { type?: string; maxLength?: number }) => (
    <td className="num">
      <input
        {...props}
        min={props.type ? 0 : undefined}
        step={props.type ? 1 : undefined}
        aria-label={`${code} ${field}`}
        value={amounts[code]?.[field] ?? ''}
        disabled={busy}
        onChange={(e) => setAmount(code, field, e.target.value)}
      />
    </td>
  )

  return (
    <section>
      <form className="registration" onSubmit={onSave}>
        <fieldset>
          {select('healthCode', 'Health Type')}
          <label className="form-field">
            <span>Plan Code *</span>
            <input value={key.planCode} maxLength={4} disabled={busy} onChange={(e) => setKey({ ...key, planCode: e.target.value.toUpperCase() })} />
          </label>
          {select('insuredCode', 'Insured Type', lookups.data?.insuredTypes)}
          <label className="form-field">
            <span>Eff Date *</span>
            <input type="date" value={key.effectiveDate} disabled={busy} onChange={(e) => setKey({ ...key, effectiveDate: e.target.value })} />
          </label>
          <div className="form-field wide table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th className="center">Sub Cat Code</th>
                  <th>Sub Cat</th>
                  <th className="num">Days/Months</th>
                  <th className="num">RM (Days/Months)</th>
                  <th className="num">RM Per Disability</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.code}>
                    <td className="center">{l.code}</td>
                    <td>{l.name}</td>
                    {cell(l.code, 'days', { type: 'number' })}
                    {cell(l.code, 'ratePerDay', { maxLength: 15 })}
                    {cell(l.code, 'perDisability', { maxLength: 50 })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        {lookups.isError && <p className="error">{errorMessage(lookups.error)}</p>}
        {load.isError && <p className="error">{errorMessage(load.error)}</p>}
        {save.isError && <p className="error">{errorMessage(save.error)}</p>}
        {exists && (
          <p className="warning">This plan, insured type and effective date already have benefits (shown above). Change them on the Benefits Listing tab.</p>
        )}
        {done && <p className="success">{done}</p>}
        <p className="muted">Only lines with an RM Per Disability are saved. Days × RM fills RM Per Disability, as in the desktop.</p>
        <div className="actions">
          <Button variant="primary" type="submit" disabled={busy || exists}>
            Save
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              resetFeedback()
              load.mutate(key)
            }}
          >
            Search
          </Button>
          <Button
            variant="link"
            disabled={busy}
            onClick={() => {
              resetFeedback()
              clear()
            }}
          >
            Clear
          </Button>
        </div>
      </form>
    </section>
  )
}
