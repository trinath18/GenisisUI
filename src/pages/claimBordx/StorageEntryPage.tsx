// Claim Bordx > Storage > Claim files (legacy frmStorageEntry, "Storage Entry"): register the cartons the claim files are kept in (Carton Details) and put claim files into them (Storage Details).
// Carton Details: search, Add a carton, tick cartons and Edit them together (one status, dates and remarks for every ticked carton), Delete a carton that holds no files. Storage Details: scan a case or
// search a range, tick the claims that are not stored, Add to give them one carton and status, Save; click a stored claim to Edit its row or Remove it.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, ComboField, DateField, SelectField, TextAreaField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { Tabs } from '../../components/Tabs'
import { downloadCsv } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoToDmy } from '../case/caseShared'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { useTickList } from '../worksheet/useTickList'
import type { SearchResult } from '../worksheet/worksheetRules'
import { cartonColumns, cartonDefaults, cartonParams, cartonSchema, cartonStatusOptions, fileSearchProblem, isCaseListed } from './storageEnquiryRules'
import type { CartonRow, CartonValues, StorageLookups } from './storageEnquiryRules'
import {
  addProblem,
  cartonFormDefaults,
  cartonFormSchema,
  cartonFromRow,
  cartonProblem,
  cartonSaveRequest,
  cartonStatusChoices,
  entryFileColumns,
  entrySearchDefaults,
  entrySearchParams,
  entrySearchSchema,
  entryStatusOptions,
  FILE_LIMIT,
  fileKey,
  fileSaveRequest,
  fileStatusChoices,
  fileTickProblem,
  storeDefaults,
  storeFromFile,
  storeProblem,
  storeSchema,
} from './storageEntryRules'
import type { CartonFormValues, EntryFileRow, EntrySearchValues, StoreValues } from './storageEntryRules'

const base = '/api/claim-bordx/storage'
const entry = '/api/claim-bordx/storage-entry'
const MAX_NOTICE = 'Only the first 5,000 rows are shown. Narrow the search to see the rest.'
type Mode = 'view' | 'add' | 'edit'

const date = <T extends object>(key: keyof T & string, label: string): GridColumn<T> => ({
  key,
  label,
  value: (r) => isoToDmy((r as Record<string, unknown>)[key] as string | null),
  sortBy: (r) => String((r as Record<string, unknown>)[key] ?? ''),
})

const cartonGrid: GridColumn<CartonRow>[] = [
  { key: 'cartonNo', label: 'CartonNo' },
  { key: 'status', label: 'Status' },
  date<CartonRow>('registerDate', 'Date Register'),
  date<CartonRow>('sendDate', 'Date Send'),
  date<CartonRow>('requestDate', 'Date Request'),
  date<CartonRow>('deliveryDate', 'Date Delivery'),
  date<CartonRow>('returnDate', 'Date Return'),
  date<CartonRow>('destroyDate', 'Date Destroy'),
  { key: 'remarks', label: 'Remarks' },
]

const fileGrid: GridColumn<EntryFileRow>[] = [
  { key: 'caseNo', label: 'CaseNo' },
  { key: 'claimVersion', label: 'Version' },
  { key: 'cartonNo', label: 'CartonNo' },
  { key: 'cartonStatus', label: 'Carton Status' },
  { key: 'fileStatus', label: 'File Status' },
  {
    key: 'billAmount',
    label: 'Bill Amt',
    align: 'right',
    value: (r) => (r.billAmount == null ? '' : formatMoney(r.billAmount)),
    sortBy: (r) => r.billAmount ?? 0,
  },
  date<EntryFileRow>('registerDate', 'Date Register'),
  { key: 'requestBy', label: 'Request By' },
  date<EntryFileRow>('requestDate', 'Date Request'),
  date<EntryFileRow>('deliveryDate', 'Date Delivery'),
  date<EntryFileRow>('returnDate', 'Date Return'),
  { key: 'duration', label: 'Duration', align: 'right' },
  { key: 'remarks', label: 'Remarks' },
  date<EntryFileRow>('bordxDate', 'Bordx Date'),
  { key: 'cashType', label: 'Cash Type' },
]

export function StorageEntryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const lookups = useQuery({
    queryKey: ['storage', 'lookups'],
    queryFn: async () => (await api.get<StorageLookups>(`${base}/lookups`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const options = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }))

  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)

  const cartons = useTickList<CartonRow>((r) => r.cartonNo)
  const [cartonMode, setCartonMode] = useState<Mode>('view')
  const [selectedCarton, setSelectedCarton] = useState<string | null>(null)
  const cartonSearch = useForm<CartonValues>({ resolver: yupResolver(cartonSchema), defaultValues: cartonDefaults, mode: 'onTouched' })
  const cartonForm = useForm<CartonFormValues>({ resolver: yupResolver(cartonFormSchema), defaultValues: cartonFormDefaults, mode: 'onTouched' })

  const files = useTickList<EntryFileRow>(fileKey, fileTickProblem)
  const [fileMode, setFileMode] = useState<Mode>('view')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const fileSearch = useForm<EntrySearchValues>({ resolver: yupResolver(entrySearchSchema), defaultValues: entrySearchDefaults, mode: 'onTouched' })
  const storeForm = useForm<StoreValues>({ resolver: yupResolver(storeSchema), defaultValues: storeDefaults, mode: 'onTouched' })
  const useScan = useWatch({ control: fileSearch.control, name: 'useScan' })

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

  // ------------------------------------------------------------ Carton Details

  function resetCarton() {
    cartonForm.reset(cartonFormDefaults)
    setCartonMode('view')
    setSelectedCarton(null)
  }

  /** CartonSearchRecord + CartonListing. */
  const loadCartons = (v: CartonValues) =>
    run(async () => {
      const { data } = await api.get<SearchResult<CartonRow>>(`${base}/cartons`, { params: cartonParams(v) })
      cartons.replace(data.rows)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify(MAX_NOTICE, 'info')
    })

  const searchCartons = cartonSearch.handleSubmit((v) => {
    resetCarton()
    return loadCartons(v)
  })

  /** cmdAdd_Click: a new carton. */
  function addCarton() {
    cartonForm.reset(cartonFormDefaults)
    setSelectedCarton(null)
    setCartonMode('add')
  }

  /** Lstcrt_Click: a carton's details are shown and can be edited. */
  function selectCarton(row: CartonRow) {
    cartonForm.reset(cartonFromRow(row))
    setSelectedCarton(row.cartonNo)
    setCartonMode('view')
  }

  const editTargets = () => (cartons.ticked.length > 0 ? cartons.ticked.map((c) => c.cartonNo) : selectedCarton ? [selectedCarton] : [])

  /** cmdSave_Click: the checks in the desktop's order, "Do you want to save the record?", then the save. */
  const saveCarton = cartonForm.handleSubmit((v) => {
    const edit = cartonMode === 'edit'
    const problem = cartonProblem(v, edit)
    if (problem) {
      cartonForm.setError(problem.field, { message: problem.message })
      return cartonForm.setFocus(problem.field)
    }
    const targets = edit ? editTargets() : [v.cartonNo.trim()]
    return run(async () => {
      if (!(await ask('Do you want to save the record?'))) return
      const { data } = await api.post<{ message: string }>(`${entry}/cartons`, cartonSaveRequest(targets, v, edit))
      notify(data.message, 'success')
      void queryClient.invalidateQueries({ queryKey: ['storage', 'lookups'] })
      const search = edit ? cartonSearch.getValues() : { ...cartonDefaults, cartonFrom: v.cartonNo.trim(), cartonTo: v.cartonNo.trim() }
      if (!edit) cartonSearch.reset(search)
      resetCarton()
      const reload = await api.get<SearchResult<CartonRow>>(`${base}/cartons`, { params: cartonParams(search) })
      cartons.replace(reload.data.rows)
    })
  })

  /** cmdDelete_Click: the selected carton, when it holds no files. */
  function deleteCarton() {
    const carton = selectedCarton
    if (!carton) return
    return run(async () => {
      if (!(await ask('Do you want to delete the record?'))) return
      const { data } = await api.delete<{ message: string }>(`${entry}/cartons/${encodeURIComponent(carton)}`)
      notify(data.message, 'success')
      void queryClient.invalidateQueries({ queryKey: ['storage', 'lookups'] })
      resetCarton()
      cartons.replace(cartons.rows.filter((c) => c.cartonNo !== carton))
    })
  }

  // ------------------------------------------------------------ Storage Details

  function resetStorage() {
    storeForm.reset(storeDefaults)
    setFileMode('view')
    setSelectedFile(null)
  }

  const fetchFiles = async (v: EntrySearchValues) => (await api.get<SearchResult<EntryFileRow>>(`${base}/files`, { params: entrySearchParams(v) })).data

  /** StorageSearchRecord + StorageListing: a scan adds the case to the list (and refuses one already listed); a range replaces the list. */
  const searchFiles = fileSearch.handleSubmit((v) => {
    const problem = fileSearchProblem(v)
    if (problem) {
      fileSearch.setError('caseFrom', { message: problem })
      return fileSearch.setFocus('caseFrom')
    }
    if (v.useScan && isCaseListed(files.rows, v.caseFrom)) return notify('Data has been uploaded!', 'error')
    resetStorage()
    return run(async () => {
      const data = await fetchFiles(v)
      if (v.useScan) files.append(data.rows)
      else files.replace(data.rows)
      if (data.rows.length === 0) notify('No record found!', 'error')
      if (data.truncated) notify(MAX_NOTICE, 'info')
      if (v.useScan) {
        fileSearch.setValue('caseFrom', '')
        fileSearch.setFocus('caseFrom')
      }
    })
  })

  /** After a save the listed claims are read again: each scanned case, or the range. */
  async function refreshFiles() {
    const v = fileSearch.getValues()
    if (!v.useScan) return files.replace((await fetchFiles(v)).rows)
    const cases = [...new Set(files.rows.map((r) => r.caseNo))]
    const answers = await Promise.all(cases.map((caseFrom) => fetchFiles({ ...v, caseFrom })))
    files.replace(answers.flatMap((a) => a.rows))
  }

  /** cmdAdd_Click: the ticked claims get one carton and status. */
  function addFiles() {
    const problem = addProblem(files.ticked.length)
    if (problem) return notify(problem, 'error')
    storeForm.reset(storeDefaults)
    setSelectedFile(null)
    setFileMode('add')
  }

  /** Lststr_Click: a stored claim's storage row is shown and can be edited or removed. */
  function selectFile(row: EntryFileRow) {
    if (!row.cartonNo) return
    storeForm.reset(storeFromFile(row))
    setSelectedFile(fileKey(row))
    setFileMode('view')
  }

  const selectedRow = () => files.rows.find((r) => fileKey(r) === selectedFile)

  /** cmdSave_Click: the details in the desktop's order, "Do you want to save the record?", then the save. */
  const saveFiles = storeForm.handleSubmit((v) => {
    const problem = storeProblem(v)
    if (problem) {
      storeForm.setError(problem.field, { message: problem.message })
      return storeForm.setFocus(problem.field)
    }
    const edit = fileMode === 'edit'
    const targets = edit ? [selectedRow()].filter((r): r is EntryFileRow => !!r) : files.ticked
    return run(async () => {
      if (!(await ask('Do you want to save the record?'))) return
      const { data } = await api.post<{ message: string }>(`${entry}/files`, fileSaveRequest(targets, v, edit))
      notify(data.message, 'success')
      resetStorage()
      await refreshFiles()
    })
  })

  /** The Remove button: takes the selected claim out of storage. */
  function removeFile() {
    const row = selectedRow()
    if (!row) return
    return run(async () => {
      if (!(await ask('Do you want to delete the record?'))) return
      const { data } = await api.delete<{ message: string }>(`${entry}/files/${encodeURIComponent(row.caseNo)}/${row.claimVersion}`)
      notify(data.message, 'success')
      resetStorage()
      await refreshFiles()
    })
  }

  // ------------------------------------------------------------ both tabs

  function print() {
    if (tab === 0 ? cartons.rows.length === 0 : files.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    if (tab === 0) downloadCsv('storage-cartons.csv', cartonColumns, cartons.rows)
    else downloadCsv('storage-claim-files.csv', entryFileColumns, files.rows)
  }

  function clear() {
    if (tab === 0) {
      cartonSearch.reset(cartonDefaults)
      cartons.clear()
      resetCarton()
    } else {
      fileSearch.reset(entrySearchDefaults)
      files.clear()
      resetStorage()
    }
  }

  const cartonError = cartonForm.formState.errors
  const storeError = storeForm.formState.errors
  const cartonEditable = cartonMode !== 'view'
  const storeEditable = fileMode !== 'view'

  const cartonPanel = (
    <>
      <form onSubmit={(e: FormEvent) => void searchCartons(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search cartons</legend>
          <TextRange label="Carton No" from="cartonFrom" to="cartonTo" maxLength={40} register={cartonSearch.register} errors={cartonSearch.formState.errors} />
          <SelectField label="Carton Status" options={cartonStatusOptions} {...cartonSearch.register('status')} />
          <DateRange label="Date Of Sending" from="sendFrom" to="sendTo" control={cartonSearch.control} register={cartonSearch.register} />
          <DateRange label="Date Of Request" from="requestFrom" to="requestTo" control={cartonSearch.control} register={cartonSearch.register} />
          <DateRange label="Date Of Delivery" from="deliveryFrom" to="deliveryTo" control={cartonSearch.control} register={cartonSearch.register} />
          <DateRange label="Date Of Return" from="returnFrom" to="returnTo" control={cartonSearch.control} register={cartonSearch.register} />
          <DateRange label="Date Of Destroy" from="destroyFrom" to="destroyTo" control={cartonSearch.control} register={cartonSearch.register} />
        </fieldset>
      </form>
      <DataGrid
        caption="Cartons"
        columns={cartonGrid}
        rows={cartons.rows}
        rowKey={(r) => r.cartonNo}
        check={{ checked: cartons.checked, onChange: cartons.change }}
        selectedKey={selectedCarton}
        onSelect={selectCarton}
        tall
        empty="No cartons. Enter the criteria and press Search."
      />
      <form onSubmit={(e: FormEvent) => void saveCarton(e)} noValidate className="screen-form">
        <fieldset disabled={!cartonEditable}>
          <legend>Carton details</legend>
          <TextField
            label="Carton No"
            required
            maxLength={20}
            disabled={cartonMode === 'edit'}
            error={cartonError.cartonNo}
            {...cartonForm.register('cartonNo')}
          />
          <SelectField label="Carton Status" required options={cartonStatusChoices} error={cartonError.status} {...cartonForm.register('status')} />
          <DateField control={cartonForm.control} name="sendDate" label="Date Of Send" />
          <DateField control={cartonForm.control} name="requestDate" label="Date Of Request" />
          <DateField control={cartonForm.control} name="deliveryDate" label="Date Of Delivery" />
          <DateField control={cartonForm.control} name="returnDate" label="Date Of Return" />
          <DateField control={cartonForm.control} name="destroyDate" label="Date Of Destroy" />
          <TextAreaField label="Remarks" wide {...cartonForm.register('remarks')} />
        </fieldset>
      </form>
    </>
  )

  const filePanel = (
    <>
      <form onSubmit={(e: FormEvent) => void searchFiles(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search claims</legend>
          <CheckField label="Use Scan" {...fileSearch.register('useScan', { onChange: () => files.clear() })} />
          {useScan ? (
            <TextField label="Case No" required maxLength={30} autoFocus error={fileSearch.formState.errors.caseFrom} {...fileSearch.register('caseFrom')} />
          ) : (
            <>
              <TextField label="Case No from" maxLength={30} autoFocus {...fileSearch.register('caseFrom')} />
              <TextField label="Case No to" maxLength={30} {...fileSearch.register('caseTo')} />
            </>
          )}
          <ComboField label="Carton No" options={options(lookups.data?.cartons)} {...fileSearch.register('carton')} />
          <SelectField label="File Status" blank={false} options={entryStatusOptions} {...fileSearch.register('fileStatus')} />
          <ComboField label="Request By" options={options(lookups.data?.users)} {...fileSearch.register('requestBy')} />
          <DateRange label="Date Of Request" from="requestFrom" to="requestTo" control={fileSearch.control} register={fileSearch.register} />
          <DateRange label="Date Of Delivery" from="deliveryFrom" to="deliveryTo" control={fileSearch.control} register={fileSearch.register} />
          <DateRange label="Date Of Return" from="returnFrom" to="returnTo" control={fileSearch.control} register={fileSearch.register} />
          <DateRange label="Date Of Bordx" from="bordxFrom" to="bordxTo" control={fileSearch.control} register={fileSearch.register} />
        </fieldset>
      </form>
      <DataGrid
        caption="Claim files"
        columns={fileGrid}
        rows={files.rows}
        rowKey={fileKey}
        check={{
          checked: files.checked,
          onChange: (next) => {
            files.change(next)
            if (next.size > FILE_LIMIT) notify('Files Limit Exceeded! ', 'error')
          },
        }}
        selectedKey={selectedFile}
        onSelect={selectFile}
        tall
        empty="No claims. Scan a case or enter a range and press Search."
      />
      <form onSubmit={(e: FormEvent) => void saveFiles(e)} noValidate className="screen-form">
        <fieldset disabled={!storeEditable}>
          <legend>Storage details</legend>
          <ComboField label="Carton No" required options={options(lookups.data?.cartons)} error={storeError.carton} {...storeForm.register('carton')} />
          <SelectField label="File Status" required options={fileStatusChoices} error={storeError.fileStatus} {...storeForm.register('fileStatus')} />
          <ComboField label="Request By" options={options(lookups.data?.users)} {...storeForm.register('requestBy')} />
          <DateField control={storeForm.control} name="requestDate" label="Date Of Req" />
          <DateField control={storeForm.control} name="deliveryDate" label="Date Of Del" />
          <DateField control={storeForm.control} name="returnDate" label="Date Of Ret" />
          <TextAreaField label="Remarks" wide {...storeForm.register('remarks')} />
        </fieldset>
      </form>
    </>
  )

  return (
    <PageShell title="Storage Entry" subtitle="Cartons and the claim files kept in them.">
      <Tabs label="Storage entry" tabs={['Carton Details', 'Storage Details']} panels={[cartonPanel, filePanel]} active={tab} onChange={setTab} />
      <ActionBar label="Storage entry actions">
        <Button variant="primary" onClick={() => void (tab === 0 ? searchCartons() : searchFiles())} busy={busy} busyLabel="Working…">
          Search
        </Button>
        <Button
          variant="ghost"
          onClick={tab === 0 ? addCarton : addFiles}
          disabled={busy || (tab === 0 ? cartonMode !== 'view' : files.rows.length === 0 || fileMode !== 'view')}
        >
          Add
        </Button>
        <Button
          variant="ghost"
          onClick={() => (tab === 0 ? setCartonMode('edit') : setFileMode('edit'))}
          disabled={busy || (tab === 0 ? editTargets().length === 0 || cartonEditable : selectedFile === null || storeEditable)}
        >
          Edit
        </Button>
        <Button
          variant="primary"
          onClick={() => void (tab === 0 ? saveCarton() : saveFiles())}
          disabled={busy || !(tab === 0 ? cartonEditable : storeEditable)}
        >
          {(tab === 0 ? cartonMode : fileMode) === 'edit' ? 'Update' : 'Save'}
        </Button>
        {tab === 0 ? (
          <Button variant="ghost" onClick={() => void deleteCarton()} disabled={busy || selectedCarton === null || cartonEditable}>
            Delete
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => void removeFile()} disabled={busy || selectedFile === null || storeEditable}>
            Remove
          </Button>
        )}
        <Button variant="ghost" onClick={print}>
          Print to File
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Records" value={tab === 0 ? cartons.rows.length : files.rows.length} />
        <Stat label="No. of Rec. checked" value={tab === 0 ? cartons.ticked.length : files.ticked.length} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
