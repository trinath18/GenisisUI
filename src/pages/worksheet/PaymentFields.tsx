import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'
import { DateField, SelectField, TextAreaField, TextField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { limits } from './adjustmentRules'
import type { AdjustmentLookups, PaymentValues } from './adjustmentRules'

/** The list as options; a saved value the list no longer has stays selectable so opening a worksheet never changes it. */
const options = (list: readonly string[], current: string): Option[] =>
  [...new Set([...list, ...(current ? [current] : [])])].map((x) => ({ value: x, label: x }))

/**
 * The payment details, the member's address, the note and the remarks of a worksheet: the three fieldsets Worksheet Adjustment's Update and Worksheet Registration's Register share.
 * They sit inside the caller's form.
 */
export function PaymentFields({
  register,
  control,
  errors,
  lookups,
  initial,
}: {
  register: UseFormRegister<PaymentValues>
  control: Control<PaymentValues>
  errors: FieldErrors<PaymentValues>
  lookups: AdjustmentLookups | undefined
  initial: PaymentValues
}) {
  return (
    <>
      <fieldset>
        <legend>Payment details</legend>
        <TextField label="Pay To" maxLength={limits.payTo} error={errors.payTo} {...register('payTo')} />
        <TextField label="GP" maxLength={limits.gpName} error={errors.gpName} {...register('gpName')} />
        <SelectField label="Bank" options={options(lookups?.banks ?? [], initial.bank)} error={errors.bank} {...register('bank')} />
        <TextField label="A/C No" maxLength={limits.accountNo} error={errors.accountNo} {...register('accountNo')} />
        <SelectField
          label="Pymt Mode"
          options={options(lookups?.paymentModes ?? ['BY POST', 'BANK-IN'], initial.paymentMode)}
          error={errors.paymentMode}
          {...register('paymentMode')}
        />
        <TextField label="Attention" maxLength={limits.attention} error={errors.attention} {...register('attention')} />
        <DateField control={control} name="lastDocumentDate" label="Last Doc." />
      </fieldset>
      <fieldset>
        <legend>Member&apos;s address</legend>
        <TextField label="Add 1" maxLength={limits.address1} error={errors.address1} {...register('address1')} />
        <TextField label="Add 2" maxLength={limits.address2} error={errors.address2} {...register('address2')} />
        <TextField label="Add 3" maxLength={limits.address3} error={errors.address3} {...register('address3')} />
        <TextField label="Post Code" maxLength={limits.postCode} error={errors.postCode} {...register('postCode')} />
        <TextField label="City" maxLength={limits.city} error={errors.city} {...register('city')} />
        <SelectField label="State" options={options(lookups?.states ?? [], initial.state)} error={errors.state} {...register('state')} />
      </fieldset>
      <fieldset>
        <legend>Note and remarks</legend>
        <TextField label="Note" wide maxLength={limits.note} error={errors.note} {...register('note')} />
        <TextAreaField
          label="Worksheet remarks"
          wide
          rows={3}
          maxLength={limits.worksheetRemarks}
          error={errors.worksheetRemarks}
          {...register('worksheetRemarks')}
        />
        <TextAreaField
          label="Credit/Debit Note Remarks"
          wide
          rows={3}
          maxLength={limits.creditDebitNoteRemarks}
          error={errors.creditDebitNoteRemarks}
          {...register('creditDebitNoteRemarks')}
        />
      </fieldset>
    </>
  )
}
