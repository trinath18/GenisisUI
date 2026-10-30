// Claim Bordx > Storage > Document (legacy frmStorageDoc, "Storage / Cartons"): put bordereaux, payment vouchers and receipts into cartons. Search the documents of a type, tick the ones to store,
// Add to fill in the carton, status and request details, Save; click a stored document and Edit to change its storage row.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { ComboField, DateField, SelectField, TextAreaField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { downloadCsv } from '../../lib/exportCsv'
import { ask, notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoToDmy } from '../case/caseShared'
import { TextRange } from '../worksheet/RangeFields'
import { useTickList } from '../worksheet/useTickList'
import type { SearchResult } from '../worksheet/worksheetRules'
import {
  addProblem,
  docTypeOptions,
  documentColumns,
  documentKey,
  documentTickProblem,
  saveRequest,
  searchDefaults,
  searchParams,
  searchSchema,
  searchStatusOptions,
  storeDefaults,
  storeFromRow,
  storeProblem,
  storeSchema,
  storeStatusOptions,
} from './storageDocumentRules'
import type { DocumentLookups, DocumentRow, DocumentSearchValues, DocumentStoreValues } from './storageDocumentRules'

const base = '/api/claim-bordx/storage-documents'
type Mode = 'view' | 'add' | 'edit'

const date = (key: keyof DocumentRow & string, label: string): GridColumn<DocumentRow> => ({
  key,
  label,
  value: (r) => isoToDmy(r[key] as string | null),
  sortBy: (r) => String(r[key] ?? ''),
})

const columns: GridColumn<DocumentRow>[] = [
  { key: 'documentNo', label: 'Doc. No' },
  { key: 'cartonNo', label: 'CartonNo' },
  { key: 'docType', label: 'Doc Type' },
  { key: 'fileStatus', label: 'File Status' },
  date('registerDate', 'Date Register'),
  { key: 'requestBy', label: 'RequestBy' },
  date('requestDate', 'Date Request'),
  date('deliveryDate', 'Date Delivery'),
  date('returnDate', 'Date Return'),
  { key: 'remarks', label: 'Remarks' },
  { key: 'department', label: 'Dept' },
]

export function StorageDocumentPage() {
  const navigate = useNavigate()
  const lookups = useQuery({
    queryKey: ['storage-documents', 'lookups'],
    queryFn: async () => (await api.get<DocumentLookups>(`${base}/lookups`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const options = (values: string[] | undefined) => (values ?? []).map((v) => ({ value: v, label: v }))

  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>('view')
  const [selected, setSelected] = useState<string | null>(null)
  const list = useTickList<DocumentRow>(documentKey, documentTickProblem)

  const searchForm = useForm<DocumentSearchValues>({ resolver: yupResolver(searchSchema), defaultValues: searchDefaults, mode: 'onTouched' })
  const storeForm = useForm<DocumentStoreValues>({ resolver: yupResolver(storeSchema), defaultValues: storeDefaults, mode: 'onTouched' })

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

  function resetStorage() {
    storeForm.reset(storeDefaults)
    setMode('view')
    setSelected(null)
  }

  /** StorageSearchRecord + StorageListing. */
  const load = (v: DocumentSearchValues) =>
    run(async () => {
      const { data } = await api.get<SearchResult<DocumentRow>>(base, { params: searchParams(v) })
      list.replace(data.rows)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify('Only the first 5,000 rows are shown. Narrow the search to see the rest.', 'info')
    })

  const search = searchForm.handleSubmit((v) => {
    resetStorage()
    return load(v)
  })

  /** cmdAdd_Click: the ticked documents get one set of storage details. */
  function add() {
    const problem = addProblem(list.ticked.length)
    if (problem) return notify(problem, 'error')
    storeForm.reset({ ...storeDefaults, docType: searchForm.getValues('docType') })
    setSelected(null)
    setMode('add')
  }

  /** Lststr_Click: a stored document's storage row is shown and can be edited. */
  function select(row: DocumentRow) {
    if (!row.docType) return
    storeForm.reset(storeFromRow(row))
    setSelected(documentKey(row))
    setMode('view')
  }

  /** cmdSave_Click: the details in the desktop's order, "Do you want to save the record?", then the save. */
  const save = storeForm.handleSubmit((v) => {
    const problem = storeProblem(v)
    if (problem) {
      storeForm.setError(problem.field, { message: problem.message })
      return storeForm.setFocus(problem.field)
    }
    const documents = mode === 'edit' && selected ? [selected] : list.ticked.map(documentKey)
    return run(async () => {
      if (!(await ask('Do you want to save the record?'))) return
      const { data } = await api.post<{ message: string }>(base, saveRequest(documents, v, mode === 'edit'))
      notify(data.message, 'success')
      resetStorage()
      await load(searchForm.getValues())
    })
  })

  function print() {
    if (list.rows.length === 0) return notify('Report cannot be printed without any record.', 'info')
    downloadCsv('storage-documents.csv', documentColumns, list.rows)
  }

  function clear() {
    searchForm.reset(searchDefaults)
    list.clear()
    resetStorage()
  }

  const editable = mode !== 'view'
  const error = storeForm.formState.errors

  return (
    <PageShell title="Storage / Cartons" subtitle="Put bordereaux, payment vouchers and receipts into cartons.">
      <form onSubmit={(e: FormEvent) => void search(e)} noValidate className="screen-form">
        <fieldset>
          <legend>Search</legend>
          <SelectField label="Document Type" blank={false} options={docTypeOptions} {...searchForm.register('docType', { onChange: () => list.clear() })} />
          <TextRange label="Document No" from="docFrom" to="docTo" maxLength={40} register={searchForm.register} errors={searchForm.formState.errors} />
          <ComboField label="Carton No" options={options(lookups.data?.cartons)} {...searchForm.register('carton')} />
          <SelectField label="File Status" blank={false} options={searchStatusOptions} {...searchForm.register('fileStatus')} />
          <ComboField label="Request By" options={options(lookups.data?.users)} {...searchForm.register('requestBy')} />
          <DateField control={searchForm.control} name="requestDate" label="Date Of Request" />
          <DateField control={searchForm.control} name="deliveryDate" label="Date Of Delivery" />
          <DateField control={searchForm.control} name="returnDate" label="Date Of Return" />
        </fieldset>
      </form>

      <DataGrid
        caption="Documents"
        columns={columns}
        rows={list.rows}
        rowKey={documentKey}
        check={{ checked: list.checked, onChange: list.change }}
        selectedKey={selected}
        onSelect={select}
        tall
        empty="No documents. Choose a type and press Search."
      />

      <form onSubmit={(e: FormEvent) => void save(e)} noValidate className="screen-form">
        <fieldset disabled={!editable}>
          <legend>Storage details</legend>
          <SelectField label="Document Type" required options={docTypeOptions} error={error.docType} {...storeForm.register('docType')} />
          <ComboField label="Carton No" required options={options(lookups.data?.cartons)} error={error.carton} {...storeForm.register('carton')} />
          <ComboField label="Dept" options={options(lookups.data?.departments)} {...storeForm.register('department')} />
          <SelectField label="File Status" required options={storeStatusOptions} error={error.fileStatus} {...storeForm.register('fileStatus')} />
          <ComboField label="Request By" options={options(lookups.data?.users)} {...storeForm.register('requestBy')} />
          <DateField control={storeForm.control} name="requestDate" label="Date Of Req" />
          <DateField control={storeForm.control} name="deliveryDate" label="Date Of Del" />
          <DateField control={storeForm.control} name="returnDate" label="Date Of Ret" />
          <TextAreaField label="Remarks" wide {...storeForm.register('remarks')} />
        </fieldset>
        <ActionBar label="Storage document actions">
          <Button variant="primary" onClick={() => void search()} busy={busy} busyLabel="Working…">
            Search
          </Button>
          <Button variant="ghost" onClick={add} disabled={busy || list.rows.length === 0}>
            Add
          </Button>
          <Button variant="ghost" onClick={() => setMode('edit')} disabled={busy || selected === null || editable}>
            Edit
          </Button>
          <Button variant="primary" type="submit" disabled={busy || !editable}>
            {mode === 'edit' ? 'Update' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={print}>
            Print File
          </Button>
          <Button variant="link" onClick={clear}>
            Clear
          </Button>
          <span className="spacer" />
          <Stat label="Records" value={list.rows.length} />
          <Stat label="No. of Rec. checked" value={list.ticked.length} />
          <Button variant="link" onClick={() => navigate('/')}>
            Close
          </Button>
        </ActionBar>
      </form>
    </PageShell>
  )
}
