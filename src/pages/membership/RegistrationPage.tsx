import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '../../api/client'
import { formatMoney } from '../../lib/format'

interface Option {
  code: string
  name: string
}

interface Lookups {
  healthCodes: Option[]
  payors: Option[]
  insuredTypes: Option[]
  races: Option[]
  nationalities: Option[]
  relationships: Option[]
  states: Option[]
  cities: Option[]
}

interface CoveredPerson {
  relationship: string
  salutation: string
  name: string
  icBcPp: string
  dateOfBirth: string
  sex: string
  occupation: string
  effectiveDate: string
  expiryDate: string
  exclusion: string
  allergic: string
}

const emptyForm = {
  healthCode: '',
  payorCode: '',
  bordxDate: '',
  batchNo: '',
  renewal: 'N',
  previousMembershipNo: '',
  previousPolicyNo: '',
  salutation: '',
  name: '',
  icBcPp: '',
  otherIc: '',
  dateOfBirth: '',
  sex: '',
  raceCode: '',
  nationalityCode: '',
  maritalStatus: '',
  address1: '',
  address2: '',
  address3: '',
  city: '',
  postCode: '',
  state: '',
  telHome: '',
  telMobile: '',
  telOffice: '',
  email: '',
  insuredType: '',
  planCode: '',
  policyNo: '',
  payorEffectiveDate: '',
  payorExpiryDate: '',
  dateJoined: '',
  takeOver: 'N',
  guaranteeRenewal: '',
  installmentMode: '',
  groupCompany: '',
  employeeNo: '',
  department: '',
  branch: '',
  agentCode: '',
  exclusion: '',
  allergic: '',
  remarks: '',
}

type Form = typeof emptyForm
type FormKey = keyof Form

const emptyPerson: CoveredPerson = {
  relationship: '',
  salutation: '',
  name: '',
  icBcPp: '',
  dateOfBirth: '',
  sex: '',
  occupation: '',
  effectiveDate: '',
  expiryDate: '',
  exclusion: '',
  allergic: '',
}

interface CoveredQuote {
  coverId: string
  name: string
  ageCode: string
  adultChild: string
  basicPremium: number
  premium: number
  basicMco: number
  mco: number
  annualLimit: number
}

interface Quote {
  ageCode: string
  adultChild: string
  memberType: string
  lifetimePlan: boolean
  basicPremium: number
  premium: number
  basicMco: number
  mco: number
  annualLimit: number
  coveredPersons: CoveredQuote[]
  warnings: string[]
}

interface SaveResult {
  membershipNo: string
  securityCode: string
  quote: Quote
}

const FAMILY_TYPES = ['F', 'H']
const SALUTATIONS = ['MR', 'MS', 'MDM', 'MRS']
const DATE_FIELDS: FormKey[] = ['bordxDate', 'dateOfBirth', 'payorEffectiveDate', 'payorExpiryDate', 'dateJoined']

const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim())

function toRequest(form: Form, covered: CoveredPerson[]) {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(form)) body[k] = blankToNull(v)
  body.batchNo = form.batchNo.trim() === '' ? null : Number(form.batchNo)
  for (const k of DATE_FIELDS) body[k] = blankToNull(form[k])
  body.coveredPersons = FAMILY_TYPES.includes(form.insuredType)
    ? covered.map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, blankToNull(v)])))
    : []
  return body
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? 'form-field wide' : 'form-field'}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options, blank = '' }: { value: string; onChange: (v: string) => void; options: Option[]; blank?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{blank}</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.code} - {o.name}
        </option>
      ))}
    </select>
  )
}

const names = (values: string[]): Option[] => values.map((v) => ({ code: v, name: v }))
const describe = (list: Option[]): Option[] => list.map((o) => ({ code: o.name, name: o.code }))

export function RegistrationPage() {
  const [form, setForm] = useState<Form>(emptyForm)
  const [covered, setCovered] = useState<CoveredPerson[]>([])
  const [saved, setSaved] = useState<SaveResult | null>(null)

  const lookups = useQuery({
    queryKey: ['registration-lookups'],
    queryFn: async () => (await api.get<Lookups>('/api/membership/registration/lookups')).data,
    staleTime: 10 * 60_000,
  })

  const plans = useQuery({
    queryKey: ['registration-plans', form.healthCode, form.payorCode],
    queryFn: async () =>
      (await api.get<Option[]>('/api/membership/registration/plans', { params: { healthCode: form.healthCode, payorCode: form.payorCode } })).data,
    enabled: form.healthCode !== '' && (form.healthCode === 'S' || form.payorCode !== ''),
  })

  const quote = useMutation({
    mutationFn: async () => (await api.post<Quote>('/api/membership/registration/quote', toRequest(form, covered))).data,
  })

  const save = useMutation({
    mutationFn: async () => (await api.post<SaveResult>('/api/membership/registration', toRequest(form, covered))).data,
    onSuccess: (result) => {
      setSaved(result)
      setForm(emptyForm)
      setCovered([])
      quote.reset()
    },
  })

  const set = (key: FormKey) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value, ...(key === 'healthCode' || key === 'payorCode' ? { planCode: '' } : {}) }))
    quote.reset()
    save.reset()
  }
  const text = (key: FormKey, extra: { type?: string; maxLength?: number; upper?: boolean } = {}) => (
    <input
      type={extra.type ?? 'text'}
      value={form[key]}
      maxLength={extra.maxLength}
      onChange={(e) => set(key)(extra.upper ? e.target.value.toUpperCase() : e.target.value)}
    />
  )

  const setPerson = (index: number, key: keyof CoveredPerson, value: string) => {
    setCovered((list) => list.map((p, i) => (i === index ? { ...p, [key]: value } : p)))
    quote.reset()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSaved(null)
    save.mutate()
  }

  if (lookups.isLoading) return <p className="muted">Loading…</p>
  if (lookups.error) return <p className="error">{errorMessage(lookups.error)}</p>
  const l = lookups.data!
  const family = FAMILY_TYPES.includes(form.insuredType)
  const shownQuote = quote.data
  const error = save.error ?? quote.error

  return (
    <section>
      <h2>Membership Registration</h2>
      {saved && (
        <p className="success" role="status">
          Registered membership <strong>{saved.membershipNo}</strong> (security code {saved.securityCode}).
        </p>
      )}
      <form className="registration" onSubmit={submit}>
        <fieldset>
          <legend>Registration</legend>
          <Field label="Health Code *">
            <Select value={form.healthCode} onChange={set('healthCode')} options={l.healthCodes} />
          </Field>
          <Field label="Payor *">
            <Select value={form.payorCode} onChange={set('payorCode')} options={l.payors} />
          </Field>
          <Field label="Bordx Date *">{text('bordxDate', { type: 'date' })}</Field>
          <Field label="Batch No *">{text('batchNo', { type: 'number' })}</Field>
          <Field label="Renewal">
            <select value={form.renewal} onChange={(e) => set('renewal')(e.target.value)}>
              <option value="N">N - New</option>
              <option value="R">R - Renewal</option>
              <option value="T">T - Transfer</option>
            </select>
          </Field>
          {form.renewal !== 'N' && (
            <>
              <Field label="Previous Membership No">{text('previousMembershipNo', { maxLength: 15, upper: true })}</Field>
              <Field label="Previous Policy No">{text('previousPolicyNo', { maxLength: 25 })}</Field>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>Principal</legend>
          <Field label="Salutation">
            <Select value={form.salutation} onChange={set('salutation')} options={names(SALUTATIONS)} />
          </Field>
          <Field label="Membership Name *">{text('name', { maxLength: 60, upper: true })}</Field>
          <Field label="IC/BC/PP *">{text('icBcPp', { maxLength: 30, upper: true })}</Field>
          <Field label="Other IC">{text('otherIc', { maxLength: 30, upper: true })}</Field>
          <Field label="Birthdate *">{text('dateOfBirth', { type: 'date' })}</Field>
          <Field label="Sex">
            <Select value={form.sex} onChange={set('sex')} options={[{ code: 'M', name: 'Male' }, { code: 'F', name: 'Female' }]} />
          </Field>
          <Field label="Race">
            <Select value={form.raceCode} onChange={set('raceCode')} options={l.races} />
          </Field>
          <Field label="Nationality">
            <Select value={form.nationalityCode} onChange={set('nationalityCode')} options={l.nationalities} />
          </Field>
          <Field label="Marital Status">
            <Select value={form.maritalStatus} onChange={set('maritalStatus')} options={[{ code: 'S', name: 'Single' }, { code: 'M', name: 'Married' }]} />
          </Field>
        </fieldset>

        <fieldset>
          <legend>Address &amp; Contact</legend>
          <Field label="Address 1 *" wide>{text('address1', { maxLength: 50 })}</Field>
          <Field label="Address 2" wide>{text('address2', { maxLength: 50 })}</Field>
          <Field label="Address 3" wide>{text('address3', { maxLength: 50 })}</Field>
          <Field label="City">
            <Select value={form.city} onChange={set('city')} options={describe(l.cities)} />
          </Field>
          <Field label="Post Code *">{text('postCode', { maxLength: 6 })}</Field>
          <Field label="State *">
            <Select value={form.state} onChange={set('state')} options={describe(l.states)} />
          </Field>
          <Field label="Tel (Home)">{text('telHome', { maxLength: 20 })}</Field>
          <Field label="Tel (Mobile)">{text('telMobile', { maxLength: 30 })}</Field>
          <Field label="Tel (Office)">{text('telOffice', { maxLength: 15 })}</Field>
          <Field label="Email">{text('email', { type: 'email', maxLength: 70 })}</Field>
        </fieldset>

        <fieldset>
          <legend>Plan</legend>
          <Field label="Insured Code *">
            <Select value={form.insuredType} onChange={set('insuredType')} options={l.insuredTypes} />
          </Field>
          <Field label="Plan Code *">
            <Select
              value={form.planCode}
              onChange={set('planCode')}
              options={plans.data ?? []}
              blank={plans.isFetching ? 'Loading…' : form.healthCode === '' || (form.healthCode !== 'S' && form.payorCode === '') ? 'Select health code and payor first' : ''}
            />
          </Field>
          <Field label="Policy No *">{text('policyNo', { maxLength: 25 })}</Field>
          <Field label="Payor Effective Date *">{text('payorEffectiveDate', { type: 'date' })}</Field>
          <Field label="Payor Expiry Date *">{text('payorExpiryDate', { type: 'date' })}</Field>
          <Field label="Date Joined">{text('dateJoined', { type: 'date' })}</Field>
          <Field label="Take Over">
            <Select value={form.takeOver} onChange={set('takeOver')} options={[{ code: 'N', name: 'None' }, { code: 'Y', name: 'Take Over' }, { code: 'C', name: 'Conversion' }]} />
          </Field>
          <Field label="Guarantee Renewal">
            <Select
              value={form.guaranteeRenewal}
              onChange={set('guaranteeRenewal')}
              options={[{ code: '1', name: 'No Life Time Limit' }, { code: '3', name: 'With Life Time Limit' }]}
            />
          </Field>
          <Field label="Installment Mode">{text('installmentMode', { maxLength: 1, upper: true })}</Field>
        </fieldset>

        <fieldset>
          <legend>Others</legend>
          <Field label="Group Company">{text('groupCompany', { maxLength: 150 })}</Field>
          <Field label="Employee No">{text('employeeNo', { maxLength: 15 })}</Field>
          <Field label="Department">{text('department', { maxLength: 250 })}</Field>
          <Field label="Branch">{text('branch', { maxLength: 50 })}</Field>
          <Field label="Agent Code">{text('agentCode', { maxLength: 15 })}</Field>
          <Field label="Exclusion" wide>
            <textarea value={form.exclusion} onChange={(e) => set('exclusion')(e.target.value)} rows={2} />
          </Field>
          <Field label="Allergic" wide>
            <textarea value={form.allergic} onChange={(e) => set('allergic')(e.target.value)} rows={2} maxLength={500} />
          </Field>
          <Field label="Remarks" wide>
            <textarea value={form.remarks} onChange={(e) => set('remarks')(e.target.value)} rows={2} />
          </Field>
        </fieldset>

        <fieldset className="covered">
          <legend>Covered Persons</legend>
          {!family ? (
            <p className="muted">Covered persons can be added for family insured codes (F, H) only.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Relationship *</th>
                      <th>Name *</th>
                      <th>IC/BC/PP</th>
                      <th>Birthdate *</th>
                      <th>Sex</th>
                      <th>Effective</th>
                      <th>Expiry</th>
                      <th>Occupation</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {covered.map((p, i) => (
                      <tr key={i}>
                        <td>{String(i + 1).padStart(2, '0')}</td>
                        <td>
                          <Select value={p.relationship} onChange={(v) => setPerson(i, 'relationship', v)} options={l.relationships} />
                        </td>
                        <td>
                          <input aria-label={`Covered person ${i + 1} name`} value={p.name} maxLength={60} onChange={(e) => setPerson(i, 'name', e.target.value.toUpperCase())} />
                        </td>
                        <td>
                          <input value={p.icBcPp} maxLength={30} onChange={(e) => setPerson(i, 'icBcPp', e.target.value.toUpperCase())} />
                        </td>
                        <td>
                          <input type="date" value={p.dateOfBirth} onChange={(e) => setPerson(i, 'dateOfBirth', e.target.value)} />
                        </td>
                        <td>
                          <select value={p.sex} onChange={(e) => setPerson(i, 'sex', e.target.value)}>
                            <option value="" />
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        </td>
                        <td>
                          <input type="date" value={p.effectiveDate} onChange={(e) => setPerson(i, 'effectiveDate', e.target.value)} />
                        </td>
                        <td>
                          <input type="date" value={p.expiryDate} onChange={(e) => setPerson(i, 'expiryDate', e.target.value)} />
                        </td>
                        <td>
                          <input value={p.occupation} maxLength={30} onChange={(e) => setPerson(i, 'occupation', e.target.value)} />
                        </td>
                        <td>
                          <button type="button" className="link" onClick={() => setCovered((list) => list.filter((_, j) => j !== i))}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => setCovered((list) => [...list, { ...emptyPerson }])}>
                Add covered person
              </button>
            </>
          )}
        </fieldset>

        {error && <p className="error" role="alert">{errorMessage(error)}</p>}

        {shownQuote && (
          <fieldset className="quote">
            <legend>Calculated</legend>
            <dl className="fields">
              {[
                ['Age Code', shownQuote.ageCode],
                ['Adult/Child', shownQuote.adultChild],
                ['Member Type', shownQuote.memberType],
                ['Lifetime Plan', shownQuote.lifetimePlan ? 'Yes' : 'No'],
                ['Basic Premium', formatMoney(shownQuote.basicPremium)],
                ['Premium', formatMoney(shownQuote.premium)],
                ['Basic MCO', formatMoney(shownQuote.basicMco)],
                ['MCO', formatMoney(shownQuote.mco)],
                ['Annual Limit', formatMoney(shownQuote.annualLimit)],
              ].map(([label, value]) => (
                <div key={label} className="field">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {shownQuote.coveredPersons.length > 0 && (
              <div className="table-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Cover ID</th>
                      <th>Name</th>
                      <th>Age Code</th>
                      <th>A/C</th>
                      <th>Premium</th>
                      <th>MCO</th>
                      <th>Annual Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownQuote.coveredPersons.map((c) => (
                      <tr key={c.coverId}>
                        <td>{c.coverId}</td>
                        <td>{c.name}</td>
                        <td>{c.ageCode}</td>
                        <td>{c.adultChild}</td>
                        <td>{formatMoney(c.premium)}</td>
                        <td>{formatMoney(c.mco)}</td>
                        <td>{formatMoney(c.annualLimit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {shownQuote.warnings.map((w) => (
              <p key={w} className="warning">{w}</p>
            ))}
          </fieldset>
        )}

        <div className="actions">
          <button type="button" onClick={() => quote.mutate()} disabled={quote.isPending || save.isPending}>
            {quote.isPending ? 'Calculating…' : 'Calculate'}
          </button>
          <button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="link" onClick={() => { setForm(emptyForm); setCovered([]); quote.reset(); save.reset(); setSaved(null) }}>
            Clear
          </button>
        </div>
      </form>
    </section>
  )
}
