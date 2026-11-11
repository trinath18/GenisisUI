import type { Control, FieldError, FieldErrors, FieldValues, Path, UseFormRegister } from 'react-hook-form'
import { CheckField, DateField, NumberField, SelectField, TextField } from '../../components/Field'
import type { Option } from '../../components/Field'

// A "from ... to" pair of criteria with an optional "is empty" tick, as the desktop search forms lay them out.

interface Pair<T extends FieldValues> {
  label: string
  from: Path<T>
  to: Path<T>
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  /** Name of the "is empty" check box; omit when the criterion has none. */
  empty?: Path<T>
}

const err = <T extends FieldValues>(errors: FieldErrors<T>, name: Path<T>) => errors[name] as FieldError | undefined

export function TextRange<T extends FieldValues>({ label, from, to, register, errors, empty, maxLength }: Pair<T> & { maxLength?: number }) {
  return (
    <>
      <TextField label={`${label} from`} maxLength={maxLength} error={err(errors, from)} {...register(from)} />
      <TextField label={`${label} to`} maxLength={maxLength} error={err(errors, to)} {...register(to)} />
      {empty && <CheckField label={`${label} is empty`} {...register(empty)} />}
    </>
  )
}

export function NumberRange<T extends FieldValues>({ label, from, to, register, errors, empty }: Pair<T>) {
  return (
    <>
      <NumberField label={`${label} from`} error={err(errors, from)} {...register(from)} />
      <NumberField label={`${label} to`} error={err(errors, to)} {...register(to)} />
      {empty && <CheckField label={`${label} is empty`} {...register(empty)} />}
    </>
  )
}

export function SelectRange<T extends FieldValues>({ label, from, to, register, errors, options }: Omit<Pair<T>, 'empty'> & { options: readonly Option[] }) {
  return (
    <>
      <SelectField label={`${label} from`} options={options} error={err(errors, from)} {...register(from)} />
      <SelectField label={`${label} to`} options={options} error={err(errors, to)} {...register(to)} />
    </>
  )
}

export function DateRange<T extends FieldValues>({
  label,
  from,
  to,
  control,
  register,
  empty,
  hint,
}: Omit<Pair<T>, 'errors'> & { control: Control<T>; hint?: string }) {
  return (
    <>
      <DateField control={control} name={from} label={`${label} from`} hint={hint} />
      <DateField control={control} name={to} label={`${label} to`} />
      {empty && <CheckField label={`${label} is empty`} {...register(empty)} />}
    </>
  )
}
