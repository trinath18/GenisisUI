// Case > MMA/CPT (legacy frmMMA, "Malaysian Medical Association"): maintain the MMA procedure schedule
// and the surgeon/anaesthetist fee look-up table. One command bar drives the active tab.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import { NumberField, SelectField, TextAreaField, TextField } from '../../components/Field'
import type { Option } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Tabs } from '../../components/Tabs'
import { Button } from '../../components/Button'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { optionalText, requiredText } from '../../lib/validation'
import { num, S } from './caseShared'

interface ProcedureRow {
  index: number
  mainBodyPart: string
  opcsCode: string
  narrative: string
  surgeonCategory: string
  anaesthetistCategory: string
  part: string
  partACost: string
  pageNo: string
}

interface LookupRow {
  index: number
  surgeonCategory: string
  surgeonFees: string
  anaesthetistCategory: string
  anaesthetistFees: string
}

interface ProcedureDto {
  index: number
  mainBodyPart: string
  opcsCode: string | null
  narrative: string | null
  surgeonCategory: string | null
  anaesthetistCategory: string | null
  part: string | null
  partACost: string | null
  pageNo: string | null
}

interface FeeDto {
  index: number
  surgeonCategory: string | null
  surgeonFees: number | null
  anaesthetistCategory: string | null
  anaesthetistFees: number | null
}

type ProcedureValues = Omit<ProcedureRow, 'index'>
type LookupValues = Omit<LookupRow, 'index'>

const toProcedure = (p: ProcedureDto): ProcedureRow => ({
  index: p.index,
  mainBodyPart: S(p.mainBodyPart),
  opcsCode: S(p.opcsCode),
  narrative: S(p.narrative),
  surgeonCategory: S(p.surgeonCategory),
  anaesthetistCategory: S(p.anaesthetistCategory),
  part: S(p.part),
  partACost: S(p.partACost),
  pageNo: S(p.pageNo),
})

const fee = (v: number | null) => (v == null ? '' : v.toFixed(2))
const toLookup = (f: FeeDto): LookupRow => ({
  index: f.index,
  surgeonCategory: S(f.surgeonCategory),
  surgeonFees: fee(f.surgeonFees),
  anaesthetistCategory: S(f.anaesthetistCategory),
  anaesthetistFees: fee(f.anaesthetistFees),
})
type Mode = 'browse' | 'add' | 'edit'

const procedureDefaults: ProcedureValues = {
  mainBodyPart: '',
  opcsCode: '',
  narrative: '',
  surgeonCategory: '',
  anaesthetistCategory: '',
  part: '',
  partACost: '',
  pageNo: '',
}
const lookupDefaults: LookupValues = { surgeonCategory: '', surgeonFees: '', anaesthetistCategory: '', anaesthetistFees: '' }

const partOptions: Option[] = ['A', 'B', 'C'].map((p) => ({ value: p, label: p }))

const procedureSchema: yup.ObjectSchema<ProcedureValues> = yup.object({
  mainBodyPart: requiredText('Please Enter Main Body Part'),
  opcsCode: requiredText('Please Enter OPCS Code'),
  narrative: requiredText('Please Enter OPCS Narrative'),
  surgeonCategory: optionalText(),
  anaesthetistCategory: optionalText(),
  part: optionalText(),
  partACost: optionalText(),
  pageNo: requiredText('Please Enter Page No'),
})

const lookupSchema: yup.ObjectSchema<LookupValues> = yup.object({
  surgeonCategory: yup
    .string()
    .trim()
    .default('')
    .test('category', "Please enter a Surgeon's or Anaesthetist's category.", function (value) {
      return !!value || !!this.parent.anaesthetistCategory
    }),
  surgeonFees: optionalText(),
  anaesthetistCategory: optionalText(),
  anaesthetistFees: optionalText(),
})

const procedureColumns: GridColumn<ProcedureRow>[] = [
  { key: 'index', label: 'Index' },
  { key: 'mainBodyPart', label: 'Main Body Part' },
  { key: 'opcsCode', label: 'OPCS Code' },
  { key: 'narrative', label: 'OPCS Narrative' },
  { key: 'surgeonCategory', label: "Surgeon's Category" },
  { key: 'anaesthetistCategory', label: "Anaesthetist's Category" },
  { key: 'part', label: 'Part', align: 'center' },
  { key: 'partACost', label: 'Part A Cost', align: 'right' },
  { key: 'pageNo', label: 'Page No', align: 'right' },
]

const lookupColumns: GridColumn<LookupRow>[] = [
  { key: 'index', label: 'Index' },
  { key: 'surgeonCategory', label: "Surgeon's Category" },
  { key: 'surgeonFees', label: "Surgeon's Fees", align: 'right' },
  { key: 'anaesthetistCategory', label: "Anaesthetist's Category" },
  { key: 'anaesthetistFees', label: "Anaesthetist's Fees", align: 'right' },
]

export function MmaCptPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [mode, setMode] = useState<Mode>('browse')
  const [procedures, setProcedures] = useState<ProcedureRow[]>([])
  const [lookups, setLookups] = useState<LookupRow[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const proc = useForm<ProcedureValues>({ resolver: yupResolver(procedureSchema), defaultValues: procedureDefaults, mode: 'onTouched' })
  const look = useForm<LookupValues>({ resolver: yupResolver(lookupSchema), defaultValues: lookupDefaults, mode: 'onTouched' })

  const total = tab === 0 ? procedures.length : lookups.length
  const hasSelection = mode === 'browse' && selected !== null

  function switchTab(index: number) {
    setTab(index)
    setMode('browse')
    setSelected(null)
  }

  function add() {
    setMode('add')
    setSelected(null)
    if (tab === 0) proc.reset(procedureDefaults)
    else look.reset(lookupDefaults)
  }

  function refresh() {
    proc.reset(procedureDefaults)
    look.reset(lookupDefaults)
    setMode('browse')
    setSelected(null)
  }

  function clear() {
    refresh()
    setProcedures([])
    setLookups([])
  }

  function print() {
    if (total === 0) {
      notify('Report cannot be printed without any record.', 'info')
      return
    }
    window.print()
  }

  /** ProcListing / LookListing: the criteria typed in the entry fields (none lists everything). */
  async function search() {
    setBusy(true)
    try {
      if (tab === 0) {
        const { mainBodyPart, opcsCode } = proc.getValues()
        const { data } = await api.get<ProcedureDto[]>('/api/case/mma-cpt/procedures', { params: { mainBodyPart, opcsCode } })
        setProcedures(data.map(toProcedure))
        if (data.length === 0) notify('Record not found', 'info')
      } else {
        const { surgeonCategory, anaesthetistCategory } = look.getValues()
        const { data } = await api.get<FeeDto[]>('/api/case/mma-cpt/fees', { params: { surgeonCategory, anaesthetistCategory } })
        setLookups(data.map(toLookup))
        if (data.length === 0) notify('Record not found', 'info')
      }
      setSelected(null)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  /** A write: report the result, then clear the entry fields and list every record again, like the desktop. */
  async function write(request: () => Promise<{ data: { message: string } }>) {
    setBusy(true)
    try {
      const { data } = await request()
      notify(data.message, 'success')
      refresh()
      await search()
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (selected === null || !(await ask('Do you want to delete the record?'))) return
    await write(() => api.delete(`/api/case/mma-cpt/${tab === 0 ? 'procedures' : 'fees'}/${selected}`))
  }

  const saveProcedure = proc.handleSubmit(async (v) => {
    if (!(await ask('Do you want to save the record?'))) return
    await write(() =>
      mode === 'edit' && selected !== null ? api.put(`/api/case/mma-cpt/procedures/${selected}`, v) : api.post('/api/case/mma-cpt/procedures', v),
    )
  })
  const saveLookup = look.handleSubmit(async (v) => {
    if (!(await ask('Do you want to save the record?'))) return
    const body = {
      surgeonCategory: v.surgeonCategory,
      surgeonFees: num(v.surgeonFees),
      anaesthetistCategory: v.anaesthetistCategory,
      anaesthetistFees: num(v.anaesthetistFees),
    }
    await write(() => (mode === 'edit' && selected !== null ? api.put(`/api/case/mma-cpt/fees/${selected}`, body) : api.post('/api/case/mma-cpt/fees', body)))
  })
  const save = () => (tab === 0 ? saveProcedure() : saveLookup())

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'browse') search()
    else save()
  }

  function pickProcedure(row: ProcedureRow) {
    const { index, ...values } = row
    proc.reset(values)
    setSelected(index)
    setMode('browse')
  }

  function pickLookup(row: LookupRow) {
    const { index, ...values } = row
    look.reset(values)
    setSelected(index)
    setMode('browse')
  }

  const proceduresPanel = (
    <form onSubmit={onSubmit} noValidate className="screen-form">
      <fieldset disabled={hasSelection}>
        <legend>Procedure</legend>
        <p className="muted">Fields marked * are mandatory. Search uses Main Body Part and OPCS Code.</p>
        <TextField label="Main Body Part" required maxLength={100} error={proc.formState.errors.mainBodyPart} {...proc.register('mainBodyPart')} />
        <TextField label="OPCS Code" required maxLength={10} error={proc.formState.errors.opcsCode} {...proc.register('opcsCode')} />
        <TextAreaField label="OPCS Narrative" required wide maxLength={400} error={proc.formState.errors.narrative} {...proc.register('narrative')} />
        <TextField label="Surgeon's Category" maxLength={30} {...proc.register('surgeonCategory')} />
        <TextField label="Anaesthetist's Category" maxLength={30} {...proc.register('anaesthetistCategory')} />
        <SelectField label="Part" options={partOptions} {...proc.register('part')} />
        <NumberField label="Part A Cost" maxLength={5} {...proc.register('partACost')} />
        <NumberField label="Page No" required maxLength={10} error={proc.formState.errors.pageNo} {...proc.register('pageNo')} />
      </fieldset>

      <fieldset className="print-area">
        <legend>Procedures List</legend>
        <h3 className="print-only">MMA Procedures</h3>
        <DataGrid
          caption="MMA procedures"
          columns={procedureColumns}
          rows={procedures}
          rowKey={(r) => String(r.index)}
          selectedKey={selected === null ? null : String(selected)}
          onSelect={pickProcedure}
          tall
          empty="No procedures. Enter Main Body Part and/or OPCS Code and press Search."
        />
      </fieldset>
    </form>
  )

  const lookupPanel = (
    <form onSubmit={onSubmit} noValidate className="screen-form">
      <fieldset disabled={hasSelection}>
        <legend>Look Up Fees</legend>
        <p className="muted">Search uses the Surgeon&apos;s and Anaesthetist&apos;s categories.</p>
        <TextField label="Surgeon's Category" maxLength={10} error={look.formState.errors.surgeonCategory} {...look.register('surgeonCategory')} />
        <NumberField label="Surgeon's Fees" maxLength={8} {...look.register('surgeonFees')} />
        <TextField label="Anaesthetist's Category" maxLength={50} {...look.register('anaesthetistCategory')} />
        <NumberField label="Anaesthetist's Fees" maxLength={8} {...look.register('anaesthetistFees')} />
      </fieldset>

      <fieldset className="print-area">
        <legend>Look Up List</legend>
        <h3 className="print-only">MMA Look Up Fees</h3>
        <DataGrid
          caption="MMA look-up fees"
          columns={lookupColumns}
          rows={lookups}
          rowKey={(r) => String(r.index)}
          selectedKey={selected === null ? null : String(selected)}
          onSelect={pickLookup}
          tall
          empty="No look-up records. Enter a category and press Search."
        />
      </fieldset>
    </form>
  )

  return (
    <PageShell title="MMA / CPT" subtitle="Malaysian Medical Association procedure schedule and fee look-up table.">
      <ActionBar label="MMA actions">
        <Button variant="ghost" onClick={search} disabled={mode !== 'browse' || busy}>
          Search
        </Button>
        <Button variant="ghost" onClick={add}>
          Add
        </Button>
        <Button variant="ghost" onClick={() => setMode('edit')} disabled={!hasSelection}>
          Edit
        </Button>
        <Button variant="ghost" onClick={remove} disabled={!hasSelection}>
          Delete
        </Button>
        <Button variant="primary" onClick={save} disabled={mode === 'browse' || busy}>
          Save
        </Button>
        <Button variant="link" onClick={refresh}>
          Refresh
        </Button>
        <Button variant="link" onClick={print}>
          Print
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Total Records" value={total} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>

      <Tabs label="MMA sections" tabs={['Procedures', 'Look Up Table']} panels={[proceduresPanel, lookupPanel]} active={tab} onChange={switchTab} />
    </PageShell>
  )
}
