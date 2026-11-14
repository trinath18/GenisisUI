// Maintenance > Surgical Schedule (rebuilt on dbo.PLNSurgOperation: the desktop has no form for it): the surgical schedule of a payor's plan, its rows added, changed and deleted. The rules are in
// surgicalScheduleRules.

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { FieldError } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { emptyValues, listColumns, rowProblem, rowRequest, searchProblem, valuesOf } from './surgicalScheduleRules'
import type { SurgicalKey, SurgicalPayor, SurgicalRow, SurgicalScheduleResult, SurgicalValues } from './surgicalScheduleRules'

const path = '/api/maintenance/surgical-schedule'
const fieldError = (message?: string): FieldError | undefined => (message ? { type: 'manual', message } : undefined)
const columns: GridColumn<SurgicalRow>[] = listColumns.map((c, i) => ({ key: `c${i}`, label: c.label, value: c.value, align: i === 2 ? 'right' : undefined }))

export function SurgicalSchedulePage() {
  const navigate = useNavigate()
  const [payors, setPayors] = useState<SurgicalPayor[]>([])
  const [key, setKey] = useState<SurgicalKey>({ payor: '', plan: '' })
  const [shown, setShown] = useState<SurgicalScheduleResult | null>(null)
  const [selected, setSelected] = useState<SurgicalRow | null>(null)
  const [values, setValues] = useState<SurgicalValues>(emptyValues)
  const [errors, setErrors] = useState<Partial<Record<keyof SurgicalValues | keyof SurgicalKey, string>>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<SurgicalPayor[]>(`${path}/payors`)
      .then(({ data }) => !cancelled && setPayors(data))
      .catch((e) => notify(errorMessage(e), 'error'))
    return () => {
      cancelled = true
    }
  }, [])

  async function run(work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function load(k: SurgicalKey) {
    const { data } = await api.get<SurgicalScheduleResult>(path, { params: { payor: k.payor.trim(), plan: k.plan.trim() } })
    setShown(data)
    setSelected(null)
    setValues(emptyValues)
  }

  function search(e: FormEvent) {
    e.preventDefault()
    const problem = searchProblem(key)
    setErrors(problem ? { [problem.field]: problem.message } : {})
    if (problem) return
    void run(async () => {
      await load(key)
    })
  }

  async function save() {
    if (!shown) return notify('Search a plan first.', 'error')
    const problem = rowProblem(values)
    setErrors(problem ? { [problem.field]: problem.message } : {})
    if (problem) return
    if (!(await ask('Do you want to save the record?'))) return
    const planKey = { payor: shown.plan.payor, plan: shown.plan.planCode }
    await run(async () => {
      const body = rowRequest(planKey, values)
      const { data } = selected ? await api.put<{ message: string }>(`${path}/${selected.index}`, body) : await api.post<{ message: string }>(path, body)
      notify(data.message, 'success')
      await load(planKey)
    })
  }

  async function remove() {
    if (!shown || !selected) return notify('Please select a record to delete.', 'error')
    if (!(await ask('Do you want to delete the record?'))) return
    const planKey = { payor: shown.plan.payor, plan: shown.plan.planCode }
    await run(async () => {
      const { data } = await api.delete<{ message: string }>(`${path}/${selected.index}`, { params: planKey })
      notify(data.message, 'success')
      await load(planKey)
    })
  }

  function startNew() {
    setSelected(null)
    setValues(emptyValues)
    setErrors({})
  }

  const set = (field: keyof SurgicalValues) => (e: { target: { value: string } }) => setValues({ ...values, [field]: e.target.value })

  return (
    <PageShell title="Surgical Schedule" subtitle="The percentage of the surgical fee a payor's plan pays for each surgical category.">
      <form onSubmit={search} noValidate className="screen-form">
        <fieldset>
          <legend>Plan</legend>
          <SelectField
            label="Payor"
            required
            options={payors.map((p) => ({ value: p.code, label: `${p.code} - ${p.name}` }))}
            value={key.payor}
            error={fieldError(errors.payor)}
            onChange={(e) => setKey({ ...key, payor: e.target.value })}
          />
          <TextField
            label="Plan Code"
            required
            maxLength={4}
            value={key.plan}
            error={fieldError(errors.plan)}
            onChange={(e) => setKey({ ...key, plan: e.target.value.toUpperCase() })}
          />
        </fieldset>
        <ActionBar label="Search actions">
          <Button variant="primary" type="submit" busy={busy} busyLabel="Searching…">
            Search
          </Button>
          <Button
            variant="ghost"
            onClick={() => (shown?.rows.length ? downloadCsv('surgical-schedule.csv', listColumns, shown.rows) : notify('Report cannot be printed without any record.', 'info'))}
          >
            Print to File
          </Button>
          <span className="spacer" />
          <Stat label="Rows" value={shown?.rows.length ?? 0} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>

      {shown && (
        <>
          <DataGrid
            caption={`Surgical schedule of plan ${shown.plan.planCode} (${shown.plan.payor})${shown.plan.description ? ` - ${shown.plan.description}` : ''}`}
            columns={columns}
            rows={shown.rows}
            rowKey={(r) => String(r.index)}
            selectedKey={selected ? String(selected.index) : null}
            onSelect={(r) => {
              setSelected(r)
              setValues(valuesOf(r))
              setErrors({})
            }}
            empty="This plan has no surgical schedule. Enter a row below and press Save."
          />
          <form onSubmit={(e) => e.preventDefault()} noValidate className="screen-form">
            <fieldset>
              <legend>{selected ? 'Change the row' : 'New row'}</legend>
              <TextField
                label="Surgical Main Category"
                required
                maxLength={50}
                value={values.mainCategory}
                error={fieldError(errors.mainCategory)}
                onChange={set('mainCategory')}
              />
              <TextField
                label="Surgical Sub Category"
                wide
                maxLength={200}
                value={values.subCategory}
                error={fieldError(errors.subCategory)}
                onChange={set('subCategory')}
              />
              <TextField
                label="Percentage"
                required
                maxLength={3}
                inputMode="numeric"
                value={values.percentage}
                error={fieldError(errors.percentage)}
                onChange={set('percentage')}
              />
            </fieldset>
            <ActionBar label="Row actions">
              <Button variant="primary" busy={busy} busyLabel="Saving…" onClick={() => void save()}>
                Save
              </Button>
              <Button variant="ghost" onClick={startNew}>
                New
              </Button>
              <Button variant="danger" disabled={!selected || busy} onClick={() => void remove()}>
                Delete
              </Button>
            </ActionBar>
          </form>
        </>
      )}
    </PageShell>
  )
}
