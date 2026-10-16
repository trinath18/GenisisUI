import { FormField } from '../../../../components/common/FormField'
import { formatDate, formatMoney } from '../../../../lib/format'
import { CoveredAction, EndorsementType, Messages, MALE_SALUTATION, OPTIONS, SALUTATIONS, editsPrincipal } from '../constants'
import { text } from '../memberForm'
import type { FormRow, FormValue, Option } from '../types'

interface SupplementaryTabProps {
  covered: FormRow[]
  endorsementType: string
  editing: boolean
  busy: boolean
  relationships: Option[]
  /** The supplementary being added or edited, or null. */
  person: FormRow | null
  /** Index in <c>covered</c> of the supplementary being edited; null while adding. */
  personIndex: number | null
  onPersonChange: (person: FormRow) => void
  onPersonBlur: (person: FormRow) => void
  onEdit: (index: number) => void
  onMark: (index: number, action: string | null) => void
  onRemoveNew: (index: number) => void
  onAdd: () => void
  onUpdate: () => void
  onClear: () => void
}

const statusLabel = (person: FormRow) =>
  person.action === CoveredAction.Remove ? 'to delete' : person.action === CoveredAction.Cancel ? 'to cancel' : text(person.status)

/** Supplementary tab: covered persons, plus the Add / Edit form of the supplementary endorsements. */
export function SupplementaryTab(props: SupplementaryTabProps) {
  const { covered, endorsementType: type, editing, busy, person, personIndex } = props
  const editPrincipal = editing && editsPrincipal(type)
  const adding = personIndex === null

  const confirmMark = (index: number, row: FormRow, action: string) =>
    window.confirm(Messages.confirm) && props.onMark(index, row.action === action ? null : action)

  const set = (key: string, value: FormValue) => person && props.onPersonChange({ ...person, [key]: value })
  const field = (key: string, label: string, options: { type?: string; maxLength?: number; disabled?: boolean } = {}) => (
    <FormField label={label}>
      <input type={options.type ?? 'text'} value={text(person?.[key])} maxLength={options.maxLength} disabled={options.disabled || busy}
        onChange={(e) => set(key, e.target.value)}
        onBlur={key === 'dateOfBirth' || key === 'planCode' ? () => person && props.onPersonBlur(person) : undefined} />
    </FormField>
  )
  const select = (key: string, label: string, options: Option[]) => (
    <FormField label={label}>
      <select value={text(person?.[key])} disabled={busy} onChange={(e) => set(key, e.target.value)}>
        <option value="" />
        {options.map((o) => <option key={o.code} value={o.code}>{o.code} - {o.name}</option>)}
      </select>
    </FormField>
  )

  return (
    <div className="registration">
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Cover</th><th>Name</th><th>Sal.</th><th>IC</th><th>DOB</th><th>Sex</th><th>A/C</th><th>Rel</th><th>Plan</th><th>Status</th>
              <th>Eff</th><th>Exp</th><th className="num">Annual</th><th className="num">Available</th><th className="num">MCO</th><th className="num">Premium</th>
              <th className="action-cell"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {covered.map((row, index) => (
              <tr key={row.coverId ? text(row.coverId) : `new-${text(row.icBcPp)}-${text(row.name)}`} className={index === personIndex ? 'selected' : undefined}>
                <td>{text(row.coverId) || 'new'}</td><td>{text(row.name)}</td><td>{text(row.salutation)}</td><td>{text(row.icBcPp)}</td>
                <td>{formatDate(row.dateOfBirth)}</td><td>{text(row.sex)}</td><td>{text(row.adultChild)}</td><td>{text(row.relationship)}</td>
                <td>{text(row.planCode)}</td><td>{statusLabel(row)}</td><td>{formatDate(row.effectiveDate)}</td><td>{formatDate(row.expiryDate)}</td>
                <td className="num">{formatMoney(row.annualLimit)}</td><td className="num">{formatMoney(row.availableLimit)}</td>
                <td className="num">{formatMoney(row.mco)}</td><td className="num">{formatMoney(row.premium)}</td>
                <td className="action-cell">
                  {editPrincipal && row.coverId && <button type="button" className="link" onClick={() => props.onEdit(index)}>Edit</button>}
                  {editing && type === EndorsementType.DeleteSupplementary && row.coverId && (
                    <button type="button" className="link" onClick={() => confirmMark(index, row, CoveredAction.Remove)}>
                      {row.action === CoveredAction.Remove ? 'Undo' : 'Remove'}
                    </button>
                  )}
                  {editing && type === EndorsementType.CancelSupplementary && row.coverId && (
                    <button type="button" className="link" onClick={() => confirmMark(index, row, CoveredAction.Cancel)}>
                      {row.action === CoveredAction.Cancel ? 'Undo' : 'Cancel'}
                    </button>
                  )}
                  {row.action === CoveredAction.Add && <button type="button" className="link" onClick={() => props.onRemoveNew(index)}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {covered.length === 0 && <p className="muted">No supplementary members.</p>}

      {person && editing && (type === EndorsementType.AddSupplementary || !adding) && (
        <fieldset>
          <legend>{adding ? 'Add Supplementary' : `Supplementary ${text(person.coverId)}`}</legend>
          <FormField label="Salutation">
            <select value={text(person.salutation)} disabled={busy}
              onChange={(e) => props.onPersonChange({ ...person, salutation: e.target.value, sex: e.target.value === MALE_SALUTATION ? 'M' : 'F' })}>
              {SALUTATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FormField>
          {field('name', 'Name *', { maxLength: 100 })}
          {field('icBcPp', 'IC/BC/PP *', { maxLength: 30 })}
          {field('dateOfBirth', 'Date of Birth *', { type: 'date', disabled: !adding && !editsPrincipal(type) })}
          {select('sex', 'Sex *', OPTIONS.sex)}
          {!adding && select('adultChild', 'Adult/Child', OPTIONS.adultChild)}
          {select('relationship', 'Relationship *', props.relationships)}
          {field('planCode', 'Plan Code', { maxLength: 4, disabled: !adding })}
          {field('effectiveDate', 'Eff Date', { type: 'date', disabled: adding })}
          {field('expiryDate', 'Exp Date', { type: 'date', disabled: adding })}
          {field('underwritingExcess', 'Und. Excess', { type: 'number' })}
          {field('claimNonPayFrom', 'Claim Non-Pay From', { type: 'date' })}
          {field('claimNonPayTo', 'Claim Non-Pay To', { type: 'date' })}
          {field('renewalDisc', 'Renewal Disc %', { type: 'number' })}
          {field('policyDisc', 'Policy Disc %', { type: 'number' })}
          {field('renewalDiscountAmount', 'Renewal Disc Amt', { type: 'number' })}
          {field('familyDiscountAmount', 'Policy Disc Amt', { type: 'number' })}
          {field('loadingPremium', 'Loading Premium', { type: 'number' })}
          {field('payorPremiumNet', 'Payor Prem Nett', { type: 'number' })}
          {field('payorMcoGross', 'Payor MCO Gross', { type: 'number' })}
          {field('payorMcoNet', 'Payor MCO Nett', { type: 'number' })}
          {!adding && (
            <>
              {field('premium', 'Premium', { type: 'number' })}
              {field('payorPremiumGross', 'Payor Prem Gross', { type: 'number' })}
              {field('previousPlanCode', 'Previous Plan', { maxLength: 25 })}
              {field('rbAmount', 'R&B Amount', { type: 'number' })}
              {field('payorRemarks', 'Payor Remarks', { maxLength: 60 })}
              {field('previousInsurer', 'Previous Insurer', { maxLength: 60 })}
              {field('generalWaitingDays', 'General WP (days)', { type: 'number' })}
              {field('generalWaitingEnd', 'General WP End', { type: 'date' })}
              {field('preExistingWaitingDays', 'Pre-Existing WP (days)', { type: 'number' })}
              {field('preExistingWaitingEnd', 'Pre-Existing WP End', { type: 'date' })}
              {field('specificIllnessWaitingDays', 'Specific Illness WP (days)', { type: 'number' })}
              {field('specificIllnessWaitingEnd', 'Specific Illness WP End', { type: 'date' })}
              {select('staffDiscount', 'Staff Discount', OPTIONS.noYes)}
              {field('payorMemberNo', 'Payor Member No', { maxLength: 8 })}
              {field('payorSeqNo', 'Payor Seq No', { maxLength: 2 })}
              {field('clientNo', 'Client No', { maxLength: 50 })}
              {field('clientId', 'Client ID', { maxLength: 15 })}
            </>
          )}
          <FormField label="Allergic" wide>
            <textarea rows={2} value={text(person.allergic)} disabled={busy} onChange={(e) => set('allergic', e.target.value)} />
          </FormField>
          <FormField label="Exclusion" wide>
            <textarea rows={2} value={text(person.exclusion)} disabled={busy} onChange={(e) => set('exclusion', e.target.value)} />
          </FormField>
          <div className="actions">
            {adding ? <button type="button" onClick={props.onAdd}>Add</button> : <button type="button" onClick={props.onUpdate}>Update</button>}
            <button type="button" onClick={props.onClear}>Clear</button>
          </div>
        </fieldset>
      )}
    </div>
  )
}
