// Case > Non-Disclosure Info (legacy frmCASNonDisclosure, "Record of Non-Disclosure"):
// record the pre-existing and underlying illness the member did not disclose.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { DateField, Field, SelectField, TextField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { Button } from '../../components/Button'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { dmyDate, optionalText, requiredText } from '../../lib/validation'
import { enterRuns, isoDmy, isoToDmy, S } from './caseShared'

interface NonDisclosureDto {
  caseNumber: string
  hasRecord: boolean
  preCategory: string | null
  preDate: string | null
  preOthers: string | null
  preInformedBy: string | null
  undCategory: string | null
  undDate: string | null
  undOthers: string | null
  undInformedBy: string | null
}

interface Values {
  caseNo: string
  preDate: string
  preCategory: string
  preOthers: string
  preInformedBy: string
  undDate: string
  undCategory: string
  undOthers: string
  undInformedBy: string
}

const defaults: Values = {
  caseNo: '',
  preDate: '',
  preCategory: '',
  preOthers: '',
  preInformedBy: '',
  undDate: '',
  undCategory: '',
  undOthers: '',
  undInformedBy: '',
}

const preCategories: Option[] = [
  { value: '1', label: '1 - Illness' },
  { value: '2', label: '2 - Injury' },
  { value: '3', label: '3 - Hospitalisation' },
  { value: '4', label: '4 - Others' },
]
const undCategories: Option[] = [
  { value: '1', label: '1 - Diabetes' },
  { value: '2', label: '2 - Hypertension' },
  { value: '3', label: '3 - Others' },
]

const PRE_OTHERS = '4'
const UND_OTHERS = '3'

const schema: yup.ObjectSchema<Values> = yup.object({
  caseNo: requiredText('Please enter the Case Number.'),
  preDate: dmyDate(),
  preCategory: optionalText(),
  preOthers: optionalText(),
  preInformedBy: optionalText(),
  undDate: dmyDate(),
  undCategory: optionalText(),
  undOthers: optionalText(),
  undInformedBy: optionalText(),
})

export function CaseNonDisclosurePage() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    trigger,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: defaults,
    mode: 'onTouched',
  })
  const [preCategory, undCategory] = useWatch({ control, name: ['preCategory', 'undCategory'] })

  async function load() {
    if (!(await trigger('caseNo'))) return
    setBusy(true)
    try {
      const { data } = await api.get<NonDisclosureDto>(`/api/case/non-disclosure/${encodeURIComponent(getValues('caseNo').trim())}`)
      reset({
        caseNo: data.caseNumber,
        preDate: isoToDmy(data.preDate),
        preCategory: S(data.preCategory),
        preOthers: S(data.preOthers),
        preInformedBy: S(data.preInformedBy),
        undDate: isoToDmy(data.undDate),
        undCategory: S(data.undCategory),
        undOthers: S(data.undOthers),
        undInformedBy: S(data.undInformedBy),
      })
      setLoaded(true)
    } catch (e) {
      setLoaded(false)
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    reset(defaults)
    setLoaded(false)
  }

  const update = handleSubmit(async (v) => {
    if (!(await ask('Are you sure?'))) return
    setBusy(true)
    try {
      const { data } = await api.put<{ message: string }>(`/api/case/non-disclosure/${encodeURIComponent(v.caseNo.trim())}`, {
        preCategory: v.preCategory,
        preDate: isoDmy(v.preDate),
        preOthers: v.preOthers,
        preInformedBy: v.preInformedBy,
        undCategory: v.undCategory,
        undDate: isoDmy(v.undDate),
        undOthers: v.undOthers,
        undInformedBy: v.undInformedBy,
      })
      notify(data.message, 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  return (
    <PageShell title="Non-Disclosure Info" subtitle="Record of non-disclosure for a case.">
      <form onSubmit={update} noValidate className="screen-form">
        <fieldset>
          <legend>Case</legend>
          <Field label="Case No" required error={errors.caseNo}>
            <div className="search-inline">
              <input
                maxLength={15}
                autoFocus
                aria-invalid={errors.caseNo ? true : undefined}
                {...register('caseNo', { onChange: () => setLoaded(false) })}
                onKeyDown={enterRuns(load)}
              />
              <Button onClick={load} busy={busy} busyLabel="Loading…">
                Load
              </Button>
            </div>
          </Field>
        </fieldset>

        <fieldset disabled={!loaded}>
          <legend>Pre-Existing Illness</legend>
          <DateField control={control} name="preDate" label="Date" />
          <SelectField
            label="Category"
            options={preCategories}
            {...register('preCategory', { onChange: (e) => e.target.value !== PRE_OTHERS && setValue('preOthers', '') })}
          />
          <TextField
            label="Pre-Existing Others"
            maxLength={50}
            disabled={preCategory !== PRE_OTHERS}
            hint="Enabled when the category is Others."
            {...register('preOthers')}
          />
          <TextField label="Informed by" maxLength={30} {...register('preInformedBy')} />
        </fieldset>

        <fieldset disabled={!loaded}>
          <legend>Underlying Illness</legend>
          <DateField control={control} name="undDate" label="Date" />
          <SelectField
            label="Category"
            options={undCategories}
            {...register('undCategory', { onChange: (e) => e.target.value !== UND_OTHERS && setValue('undOthers', '') })}
          />
          <TextField
            label="Underlying Illness Others"
            maxLength={50}
            disabled={undCategory !== UND_OTHERS}
            hint="Enabled when the category is Others."
            {...register('undOthers')}
          />
          <TextField label="Informed by" maxLength={30} {...register('undInformedBy')} />
        </fieldset>

        <ActionBar label="Non-disclosure actions">
          <Button variant="primary" type="submit" disabled={!loaded || busy}>
            Update
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>
    </PageShell>
  )
}
