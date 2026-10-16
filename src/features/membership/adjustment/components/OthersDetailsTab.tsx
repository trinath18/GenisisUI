import { FormField } from '../../../../components/common/FormField'
import { formatDate } from '../../../../lib/format'
import { OPTIONS } from '../constants'
import { text } from '../memberForm'
import type { LoadedMembership, MemberForm } from '../types'
import { MemberInput, MemberSelect, MemberTextArea } from './MemberControls'

/** Others Details tab (desktop "Others Details" form): contact, policy and health fields. */
export function OthersDetailsTab({ form, original }: { form: MemberForm; original: LoadedMembership }) {
  const member = form.member
  return (
    <div className="registration">
      <fieldset>
        <legend>Contact</legend>
        <FormField label="Tel (Home)"><MemberInput form={form} field="telHome" maxLength={20} /></FormField>
        <FormField label="Tel (Mobile)"><MemberInput form={form} field="telMobile" maxLength={30} /></FormField>
        <FormField label="Tel (Office)"><MemberInput form={form} field="telOffice" maxLength={15} /></FormField>
        <FormField label="Email"><MemberInput form={form} field="email" maxLength={70} /></FormField>
        <FormField label="Language"><MemberInput form={form} field="lgnCode" maxLength={2} upperCase /></FormField>
        <FormField label="Sending Mode"><input value={text(member.sendingMode)} disabled /></FormField>
        <FormField label="Card Sent Date"><input value={formatDate(original.member.cardSentDate)} disabled /></FormField>
        <FormField label="Bank A/C No"><MemberInput form={form} field="bankAccountNo" maxLength={25} /></FormField>
      </fieldset>
      <fieldset>
        <legend>Policy</legend>
        <FormField label="Policy Sub No"><MemberInput form={form} field="policySubNo" maxLength={50} /></FormField>
        <FormField label="Label Printed">
          <input type="checkbox" checked={!!member.labelStatus} disabled={!form.editable || form.busy} onChange={(e) => form.set('labelStatus', e.target.checked)} />
        </FormField>
        <FormField label="New Plan Code"><MemberInput form={form} field="newPlanCode" maxLength={4} upperCase /></FormField>
        <FormField label="New Policy Eff Date"><MemberInput form={form} field="newPolicyEffectiveDate" type="date" /></FormField>
        <FormField label="Policy Condition"><MemberSelect form={form} field="policyCondition" options={OPTIONS.policyCondition} /></FormField>
        <FormField label="Endt Ref No"><MemberInput form={form} field="endtRefNo" maxLength={20} /></FormField>
        <FormField label="Claim Non-Pay From"><MemberInput form={form} field="claimNonPayFrom" type="date" /></FormField>
        <FormField label="Claim Non-Pay To"><MemberInput form={form} field="claimNonPayTo" type="date" /></FormField>
        <FormField label="Underwriting Excess"><MemberInput form={form} field="underwritingExcess" type="number" /></FormField>
        <FormField label="Policy Disc %"><MemberInput form={form} field="policyDisc" type="number" /></FormField>
        <FormField label="Renewal Disc %"><MemberInput form={form} field="renewalDisc" type="number" /></FormField>
        <FormField label="Family Disc Amt"><MemberInput form={form} field="familyDiscountAmount" type="number" /></FormField>
        <FormField label="Renewal Disc Amt"><MemberInput form={form} field="renewalDiscountAmount" type="number" /></FormField>
        <FormField label="Loading Premium"><MemberInput form={form} field="loadingPremium" type="number" /></FormField>
        <FormField label="Payor Prem Gross"><MemberInput form={form} field="payorPremiumGross" type="number" /></FormField>
        <FormField label="Payor Prem Nett"><MemberInput form={form} field="payorPremiumNet" type="number" /></FormField>
        <FormField label="Payor MCO Gross"><MemberInput form={form} field="payorMcoGross" type="number" /></FormField>
        <FormField label="Payor MCO Nett"><MemberInput form={form} field="payorMcoNet" type="number" /></FormField>
        <FormField label="Staff Discount"><MemberSelect form={form} field="staffDiscount" options={OPTIONS.noYes} /></FormField>
        <FormField label="BTBG"><MemberSelect form={form} field="btbg" options={OPTIONS.yesNo} /></FormField>
      </fieldset>
      <fieldset>
        <legend>Health</legend>
        <FormField label="Occupation"><MemberInput form={form} field="occupation" maxLength={60} /></FormField>
        <FormField label="Work Nature"><MemberInput form={form} field="workNature" maxLength={3} /></FormField>
        <FormField label="Weight"><MemberInput form={form} field="weight" maxLength={3} /></FormField>
        <FormField label="Height"><MemberInput form={form} field="height" maxLength={3} /></FormField>
        <FormField label="Blood"><MemberSelect form={form} field="blood" options={OPTIONS.bloodTypes} storeName /></FormField>
        <FormField label="Smoking"><MemberSelect form={form} field="smoking" options={OPTIONS.yesNo} /></FormField>
        <FormField label="Alcohol"><MemberSelect form={form} field="alcohol" options={OPTIONS.yesNo} /></FormField>
        <FormField label="Previous Plan"><MemberInput form={form} field="previousPlanCode" maxLength={25} /></FormField>
        <FormField label="R&B Amount"><MemberInput form={form} field="rbAmount" type="number" /></FormField>
        <FormField label="Previous Insurer"><MemberInput form={form} field="previousInsurer" maxLength={60} /></FormField>
        <FormField label="Co-Pay R&B"><MemberInput form={form} field="coPayRb" maxLength={2} /></FormField>
        <FormField label="General WP (days)"><MemberInput form={form} field="generalWaitingDays" type="number" /></FormField>
        <FormField label="General WP End"><MemberInput form={form} field="generalWaitingEnd" type="date" /></FormField>
        <FormField label="Pre-Existing WP (days)"><MemberInput form={form} field="preExistingWaitingDays" type="number" /></FormField>
        <FormField label="Pre-Existing WP End"><MemberInput form={form} field="preExistingWaitingEnd" type="date" /></FormField>
        <FormField label="Specific Illness WP (days)"><MemberInput form={form} field="specificIllnessWaitingDays" type="number" /></FormField>
        <FormField label="Specific Illness WP End"><MemberInput form={form} field="specificIllnessWaitingEnd" type="date" /></FormField>
        <FormField label="Allergic" wide><MemberTextArea form={form} field="allergic" /></FormField>
      </fieldset>
    </div>
  )
}
