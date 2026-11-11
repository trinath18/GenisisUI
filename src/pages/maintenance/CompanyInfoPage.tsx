// Maintenance > Company Info (legacy FrmMaintenanceComInfo, "Company Information"): the one row with the company's code, name, address, phone, fax, e-mail, homepage and current year.

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { TextAreaField, TextField } from '../../components/Field'
import { ActionBar, PageShell } from '../../components/Screen'
import { Button } from '../../components/Button'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { companyInfoDefaults, companyInfoFromRow, companyInfoProblem, companyInfoRequest, companyInfoSchema } from './companyInfoRules'
import type { CompanyInfoRow, CompanyInfoValues } from './companyInfoRules'

const path = '/api/maintenance/company-info'

export function CompanyInfoPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    getValues,
    formState: { errors },
  } = useForm<CompanyInfoValues>({ resolver: yupResolver(companyInfoSchema), defaultValues: companyInfoDefaults, mode: 'onTouched' })

  /** LoadCOMInfo: the saved details ("Record not found" when the table is empty). */
  useEffect(() => {
    let cancelled = false
    api
      .get<CompanyInfoRow>(path)
      .then(({ data }) => {
        if (cancelled) return
        if (!data.tableExists) notify('The Company table is not in this database.', 'error')
        else if (data.found) reset(companyInfoFromRow(data))
        else notify('Record not found', 'info')
      })
      .catch((e) => notify(errorMessage(e), 'error'))
    return () => {
      cancelled = true
    }
  }, [reset])

  /** cmdUpdate_Click: the required boxes in the desktop's order, "Do you want to save the record?", then the save. */
  const save = handleSubmit(async (v) => {
    const problem = companyInfoProblem(v)
    if (problem) {
      setError(problem.field, { message: problem.message })
      return setFocus(problem.field)
    }
    if (!(await ask('Do you want to save the record?'))) return
    setBusy(true)
    try {
      const { data } = await api.put<{ message: string }>(path, companyInfoRequest(getValues()))
      notify(data.message, 'success')
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  })

  return (
    <PageShell title="Company Information" subtitle="The company's details.">
      <form onSubmit={(e: FormEvent) => void save(e)} noValidate className="screen-form">
        <fieldset>
          <legend>MediExpress (M) Sdn Bhd</legend>
          <TextField label="Company Code" required maxLength={50} error={errors.code} {...register('code')} />
          <TextField label="Company Name" required maxLength={150} error={errors.name} {...register('name')} />
          <TextAreaField label="Address" maxLength={200} rows={3} error={errors.address} {...register('address')} />
          <TextField label="Phone No" maxLength={15} inputMode="tel" error={errors.phone} {...register('phone')} />
          <TextField label="Fax No" maxLength={15} inputMode="tel" error={errors.fax} {...register('fax')} />
          <TextField label="Email" maxLength={150} inputMode="email" error={errors.email} {...register('email')} />
          <TextField label="Homepage" maxLength={150} error={errors.homepage} {...register('homepage')} />
          <TextField label="Current Year" required maxLength={4} inputMode="numeric" error={errors.currentYear} {...register('currentYear')} />
        </fieldset>
        <ActionBar label="Company information actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Saving…">
            Update
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
