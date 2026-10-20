import * as yup from 'yup'
import { parseDmy } from './masks'

/** Required free text (legacy "Please Enter ..." MsgBox). */
export const requiredText = (message: string) => yup.string().trim().required(message)

/** Optional free text, always a string in the form values. */
export const optionalText = () => yup.string().trim().default('')

/** MaskEdBox "##/##/####": empty is allowed; anything typed must be a real dd/mm/yyyy date (LostFocus "Invalid Date Format!"). */
export const dmyDate = (invalid = 'Invalid Date Format!') =>
  yup
    .string()
    .default('')
    .test('dmy', invalid, (v) => !v || parseDmy(v) !== null)

export const requiredDmyDate = (required: string, invalid?: string) => dmyDate(invalid).required(required)

/** MaskEdBox "##:##" (24-hour). */
export const hhmmTime = (invalid = 'Invalid Time Format!') =>
  yup
    .string()
    .default('')
    .test('hhmm', invalid, (v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v))

/** KeyNumber fields: digits with at most one decimal point. */
export const amount = (invalid = 'Enter a valid amount.') =>
  yup
    .string()
    .default('')
    .test('amount', invalid, (v) => !v || /^\d+(\.\d+)?$/.test(v))
