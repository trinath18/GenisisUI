import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { formatDate, formatMoney } from '../../../../lib/format'
import { OPTIONS } from '../constants'
import { text } from '../memberForm'
import type { AdjustmentLookups, LoadedMembership, MemberForm, Option, Recalculation } from '../types'
import { MemberInput, MemberSelect, MemberTextArea } from './MemberControls'

interface PrincipalDetailsTabProps {
  form: MemberForm
  original: LoadedMembership
  lookups: AdjustmentLookups
  plans: Option[]
  onPlanChange: (planCode: string) => void
  onPolicyBlur: () => void
  recalculation: Recalculation | null
  recalculating: boolean
  recalculateError: unknown
  onRecalculate: () => void
  onUsePremium: () => void
  onUseMco: () => void
  applyAnnualLimit: boolean
  onApplyAnnualLimitChange: (apply: boolean) => void
}

/** Principal Details tab: membership, principal and fee fields. */
export function PrincipalDetailsTab(props: PrincipalDetailsTabProps) {
  const { form, original, lookups, recalculation } = props
  const member = form.member
  const stored = original.member
  return (
    <div className="registration">
      <fieldset>
        <legend>Membership</legend>
        <FormField label="Membership No"><input value={text(member.membershipNo)} disabled /></FormField>
        <FormField label="Health Type"><input value={text(member.healthCode)} disabled /></FormField>
        <FormField label="Payor"><input value={text(member.payorCode)} disabled /></FormField>
        <FormField label="Insured Type"><input value={text(member.insuredType)} disabled /></FormField>
        <FormField label="Plan Code">
          {form.editable ? (
            <select value={text(member.planCode)} disabled={form.busy} onChange={(e) => props.onPlanChange(e.target.value)}>
              <option value={text(stored.planCode)}>{text(stored.planCode)}</option>
              {props.plans.filter((p) => p.code !== stored.planCode).map((p) => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
            </select>
          ) : (
            <input value={text(member.planCode)} disabled />
          )}
        </FormField>
        <FormField label="Policy No *">
          <input value={text(member.policyNo)} maxLength={25} disabled={!form.editable || form.busy}
            onChange={(e) => form.set('policyNo', e.target.value.toUpperCase())} onBlur={props.onPolicyBlur} />
        </FormField>
        <FormField label="Payor Eff Date *"><MemberInput form={form} field="payorEffectiveDate" type="date" /></FormField>
        <FormField label="Payor Exp Date *"><MemberInput form={form} field="payorExpiryDate" type="date" /></FormField>
        <FormField label="Final Exp Date"><input value={formatDate(stored.finalExpiryDate)} disabled /></FormField>
        <FormField label="Next Due Date"><MemberInput form={form} field="nextDueDate" type="date" /></FormField>
        <FormField label="Bordx Date *"><MemberInput form={form} field="bordxDate" type="date" /></FormField>
        <FormField label="Value Date (DOR)"><input value={formatDate(stored.valueDate)} disabled /></FormField>
        <FormField label="Policy Year"><input value={text(member.policyYear)} disabled /></FormField>
        <FormField label="Age Code"><input value={text(member.ageCode)} disabled /></FormField>
        <FormField label="Adult/Child"><input value={text(member.adultChild)} disabled /></FormField>
        <FormField label="Take Over"><MemberSelect form={form} field="takeOver" options={OPTIONS.takeOver} allowBlank={false} /></FormField>
        <FormField label="Renewal"><MemberSelect form={form} field="renewal" options={OPTIONS.renewal} /></FormField>
        <FormField label="Data Status"><MemberSelect form={form} field="dataStatus" options={OPTIONS.dataStatus} /></FormField>
        <FormField label="Expired Status"><input value={text(member.expiredStatus)} disabled /></FormField>
        <FormField label="Guarantee Renewal"><input value={text(member.guaranteeRenewal)} disabled /></FormField>
        <FormField label="Installment Mode"><MemberSelect form={form} field="installmentMode" options={OPTIONS.installmentMode} /></FormField>
        <FormField label="Date Joined"><MemberInput form={form} field="dateJoined" type="date" /></FormField>
        {original.limit && (
          <FormField label="Supp. Limit Type">
            <input value={[text(original.limit.suppLimitStatus), text(original.limit.suppLimitDescription)].filter(Boolean).join(' - ')} disabled />
          </FormField>
        )}
        {original.clinic && (
          <FormField label="Clinical Plan"><input value={`${text(original.clinic.planCode)} / ${text(original.clinic.insuredType)}`} disabled /></FormField>
        )}
      </fieldset>
      <fieldset>
        <legend>Principal</legend>
        <FormField label="Salutation"><MemberSelect form={form} field="salutation" options={OPTIONS.salutations} storeName /></FormField>
        <FormField label="Name"><MemberInput form={form} field="name" maxLength={100} upperCase /></FormField>
        <FormField label="IC/BC/PP *"><MemberInput form={form} field="icBcPp" maxLength={30} upperCase /></FormField>
        <FormField label="Other IC"><input value={text(member.otherIc)} disabled /></FormField>
        <FormField label="Date of Birth *"><MemberInput form={form} field="dateOfBirth" type="date" /></FormField>
        <FormField label="Sex *"><MemberSelect form={form} field="sex" options={OPTIONS.sex} /></FormField>
        <FormField label="Marital Status"><MemberSelect form={form} field="maritalStatus" options={OPTIONS.maritalStatus} /></FormField>
        <FormField label="Race"><MemberSelect form={form} field="raceCode" options={lookups.races} /></FormField>
        <FormField label="Nationality"><MemberSelect form={form} field="nationalityCode" options={lookups.nationalities} /></FormField>
        <FormField label="Address 1 *" wide><MemberInput form={form} field="address1" maxLength={60} upperCase /></FormField>
        <FormField label="Address 2" wide><MemberInput form={form} field="address2" maxLength={60} upperCase /></FormField>
        <FormField label="Address 3" wide><MemberInput form={form} field="address3" maxLength={60} upperCase /></FormField>
        <FormField label="City"><MemberSelect form={form} field="city" options={lookups.cities} storeName /></FormField>
        <FormField label="Post Code *"><MemberInput form={form} field="postCode" maxLength={6} /></FormField>
        <FormField label="State *"><MemberSelect form={form} field="state" options={lookups.states} storeName /></FormField>
        <FormField label="Group Company"><MemberInput form={form} field="groupCompany" maxLength={150} /></FormField>
        <FormField label="Employee No"><MemberInput form={form} field="employeeNo" maxLength={15} /></FormField>
        <FormField label="Department"><MemberInput form={form} field="department" maxLength={250} /></FormField>
        <FormField label="Branch"><MemberInput form={form} field="branch" maxLength={50} upperCase /></FormField>
        <FormField label="Agent Code"><MemberInput form={form} field="agentCode" maxLength={15} /></FormField>
        <FormField label="Cost Center"><MemberInput form={form} field="costCenter" maxLength={100} /></FormField>
        <FormField label="Position"><MemberInput form={form} field="position" maxLength={100} /></FormField>
        <FormField label="Group Category"><MemberInput form={form} field="groupCategory" maxLength={100} /></FormField>
        <FormField label="Division"><MemberInput form={form} field="division" maxLength={100} /></FormField>
        <FormField label="Sub Division"><MemberInput form={form} field="subDivision" maxLength={100} /></FormField>
        <FormField label="Subsidiary"><MemberInput form={form} field="subsidiary" maxLength={200} /></FormField>
        <FormField label="Exclusion" wide><MemberTextArea form={form} field="exclusion" /></FormField>
        <FormField label="Remarks" wide><MemberTextArea form={form} field="remarks" /></FormField>
      </fieldset>
      <fieldset>
        <legend>Fees</legend>
        <FormField label="Basic Premium"><MemberInput form={form} field="basicPremium" type="number" /></FormField>
        <FormField label="Premium"><MemberInput form={form} field="premium" type="number" /></FormField>
        <FormField label="MCO Fee"><MemberInput form={form} field="mcoFee" type="number" /></FormField>
        <FormField label="Available Limit"><input value={formatMoney(stored.availableLimit)} disabled /></FormField>
        {form.editable && (
          <div className="form-field wide">
            <div className="actions">
              <button type="button" disabled={props.recalculating || form.busy} onClick={props.onRecalculate}>Recalculate fees</button>
            </div>
            {props.recalculateError != null && <p className="error" role="alert">{errorMessage(props.recalculateError)}</p>}
            {recalculation && (
              <div>
                <p className="muted">
                  Age band {recalculation.ageCode} ({recalculation.adultChild}); premium {formatMoney(recalculation.premium)} (basic{' '}
                  {formatMoney(recalculation.basicPremium)}); MCO {formatMoney(recalculation.mco)}; annual limit {formatMoney(recalculation.annualLimit)}.
                </p>
                {recalculation.warnings.map((w) => <p key={w} className="warning">{w}</p>)}
                <div className="actions">
                  <button type="button" onClick={props.onUsePremium}>Use new premium</button>
                  <button type="button" disabled={Number(member.mcoFee) === recalculation.mco} onClick={props.onUseMco}>Change member's MCO Fee</button>
                  {recalculation.annualLimit != null && recalculation.annualLimit !== Number(stored.availableLimit ?? 0) && (
                    <label>
                      <input type="checkbox" checked={props.applyAnnualLimit} onChange={(e) => props.onApplyAnnualLimitChange(e.target.checked)} /> Change Annual
                      Limit to {formatMoney(recalculation.annualLimit)}
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </fieldset>
    </div>
  )
}
