// Claim Bordx > Storage > Enquiry (legacy frmStorageEnq, "Storage Enquiry"): the Carton Details tab (the cartons the claim files are kept in) and the Storage Details tab (the files in them).
// Read only. A scan on the Storage Details tab adds a case to the list; a range search replaces it; "Listing" writes the check sheet of a carton.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckField, ComboField, SelectField, TextField } from '../../components/Field'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { ActionBar, PageShell, Stat } from '../../components/Screen'
import { Button } from '../../components/Button'
import { Tabs } from '../../components/Tabs'
import { downloadCsv } from '../../lib/exportCsv'
import { formatMoney } from '../../lib/format'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { DateRange, TextRange } from '../worksheet/RangeFields'
import { useWorksheetLookups } from '../worksheet/useWorksheetLookups'
import type { SearchResult } from '../worksheet/worksheetRules'
import {
  cartonColumns,
  cartonDefaults,
  cartonParams,
  cartonSchema,
  cartonStatusOptions,
  checkSheetColumns,
  checkSheetRows,
  fileColumns,
  fileDefaults,
  fileParams,
  fileSchema,
  fileSearchProblem,
  fileStatusOptions,
  isCaseListed,
  listingProblem,
} from './storageEnquiryRules'
import type { CartonFile, CartonRow, CartonValues, FileRow, FileValues, StorageLookups } from './storageEnquiryRules'
import { isoToDmy } from '../case/caseShared'

const base = '/api/claim-bordx/storage'
const MAX_NOTICE = 'Only the first 5,000 rows are shown. Narrow the search to see the rest.'

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

const fileGrid: GridColumn<FileRow>[] = [
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
  date<FileRow>('sendDate', 'Date Sent'),
  date<FileRow>('registerDate', 'Date Register'),
  { key: 'requestBy', label: 'Request By' },
  date<FileRow>('requestDate', 'Date Request'),
  date<FileRow>('deliveryDate', 'Date Delivery'),
  date<FileRow>('returnDate', 'Date Return'),
  { key: 'duration', label: 'Duration', align: 'right' },
  { key: 'remarks', label: 'Remarks' },
]

export function StorageEnquiryPage() {
  const navigate = useNavigate()
  const lookups = useWorksheetLookups()
  const stored = useQuery({
    queryKey: ['storage', 'lookups'],
    queryFn: async () => (await api.get<StorageLookups>(`${base}/lookups`)).data,
    staleTime: 10 * 60 * 1000,
  })
  const cartonOptions = (stored.data?.cartons ?? []).map((c) => ({ value: c, label: c }))
  const userOptions = (stored.data?.users ?? []).map((u) => ({ value: u, label: u }))

  const [tab, setTab] = useState(0)
  const [busy, setBusy] = useState(false)
  const [cartons, setCartons] = useState<CartonRow[]>([])
  const [files, setFiles] = useState<FileRow[]>([])

  const cartonForm = useForm<CartonValues>({ resolver: yupResolver(cartonSchema), defaultValues: cartonDefaults, mode: 'onTouched' })
  const fileForm = useForm<FileValues>({ resolver: yupResolver(fileSchema), defaultValues: fileDefaults, mode: 'onTouched' })
  const useScan = useWatch({ control: fileForm.control, name: 'useScan' })

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

  /** CartonSearchRecord + CartonListing. */
  const searchCartons = cartonForm.handleSubmit((v) =>
    run(async () => {
      const { data } = await api.get<SearchResult<CartonRow>>(`${base}/cartons`, { params: cartonParams(v) })
      setCartons(data.rows)
      if (data.rows.length === 0) notify('No record found!', 'error')
      else if (data.truncated) notify(MAX_NOTICE, 'info')
    }),
  )

  /** cmdSearch_Click on the Storage Details tab: a scan adds the case to the list (and refuses one already listed); a range replaces the list. */
  const searchFiles = fileForm.handleSubmit((v) => {
    const problem = fileSearchProblem(v)
    if (problem) {
      fileForm.setError('caseFrom', { message: problem })
      return fileForm.setFocus('caseFrom')
    }
    if (v.useScan && isCaseListed(files, v.caseFrom)) return notify('Data has been uploaded!', 'error')
    return run(async () => {
      const { data } = await api.get<SearchResult<FileRow>>(`${base}/files`, { params: fileParams(v) })
      setFiles(v.useScan ? [...files, ...data.rows] : data.rows)
      if (data.rows.length === 0) notify('No record found!', 'error')
      if (data.truncated) notify(MAX_NOTICE, 'info')
      if (v.useScan) {
        fileForm.setValue('caseFrom', '')
        fileForm.setFocus('caseFrom')
      }
    })
  })

  /** CmdListing_Click: the check sheet of the carton in the Carton No box. */
  function listing() {
    const carton = fileForm.getValues('cartonFrom')
    const problem = listingProblem(carton)
    if (problem) {
      notify(problem, 'error')
      return fileForm.setFocus('cartonFrom')
    }
    return run(async () => {
      const { data } = await api.get<CartonFile[]>(`${base}/carton-files`, { params: { carton: carton.trim() } })
      if (data.length === 0) return notify('No record found!', 'error')
      downloadCsv(`carton-${carton.trim()}-check-sheet.csv`, checkSheetColumns, checkSheetRows(data))
    })
  }

  /** CmdPrintFile_Click. */
  function print() {
    if (tab === 0 ? cartons.length === 0 : files.length === 0) return notify('Report cannot be printed without any record.', 'info')
    if (tab === 0) downloadCsv('storage-cartons.csv', cartonColumns, cartons)
    else downloadCsv('storage-files.csv', fileColumns, files)
  }

  function clear() {
    if (tab === 0) {
      cartonForm.reset(cartonDefaults)
      setCartons([])
    } else {
      fileForm.reset(fileDefaults)
      setFiles([])
    }
  }

  const cartonPanel = (
    <form onSubmit={(e: FormEvent) => void searchCartons(e)} noValidate className="screen-form">
      <fieldset>
        <legend>Carton Details</legend>
        <TextRange label="Carton No" from="cartonFrom" to="cartonTo" maxLength={40} register={cartonForm.register} errors={cartonForm.formState.errors} />
        <SelectField label="Carton Status" options={cartonStatusOptions} {...cartonForm.register('status')} />
        <DateRange label="Date Of Sending" from="sendFrom" to="sendTo" control={cartonForm.control} register={cartonForm.register} />
        <DateRange label="Date Of Request" from="requestFrom" to="requestTo" control={cartonForm.control} register={cartonForm.register} />
        <DateRange label="Date Of Delivery" from="deliveryFrom" to="deliveryTo" control={cartonForm.control} register={cartonForm.register} />
        <DateRange label="Date Of Return" from="returnFrom" to="returnTo" control={cartonForm.control} register={cartonForm.register} />
        <DateRange label="Date Of Destroy" from="destroyFrom" to="destroyTo" control={cartonForm.control} register={cartonForm.register} />
      </fieldset>
      <DataGrid
        caption="Cartons"
        columns={cartonGrid}
        rows={cartons}
        rowKey={(r) => r.cartonNo}
        tall
        empty="No cartons. Enter the criteria and press Search."
      />
    </form>
  )

  const filePanel = (
    <form onSubmit={(e: FormEvent) => void searchFiles(e)} noValidate className="screen-form">
      <fieldset>
        <legend>Storage Details</legend>
        <CheckField label="Use Scan" {...fileForm.register('useScan', { onChange: () => setFiles([]) })} />
        {useScan ? (
          <TextField label="Case No" required maxLength={30} autoFocus error={fileForm.formState.errors.caseFrom} {...fileForm.register('caseFrom')} />
        ) : (
          <>
            <TextField label="Case No from" maxLength={30} autoFocus {...fileForm.register('caseFrom')} />
            <TextField label="Case No to" maxLength={30} {...fileForm.register('caseTo')} />
          </>
        )}
        <ComboField label="Carton No from" options={cartonOptions} {...fileForm.register('cartonFrom')} />
        <ComboField label="Carton No to" options={cartonOptions} {...fileForm.register('cartonTo')} />
        <SelectField label="File Status" options={fileStatusOptions} {...fileForm.register('fileStatus')} />
        <ComboField label="Request By" options={userOptions} {...fileForm.register('requestBy')} />
        <ComboField label="Payor from" options={lookups.payors} {...fileForm.register('payorFrom')} />
        <ComboField label="Payor to" options={lookups.payors} {...fileForm.register('payorTo')} />
        <DateRange label="Date Of Request" from="requestFrom" to="requestTo" control={fileForm.control} register={fileForm.register} />
        <DateRange label="Date Of Delivery" from="deliveryFrom" to="deliveryTo" control={fileForm.control} register={fileForm.register} />
        <DateRange label="Date Of Return" from="returnFrom" to="returnTo" control={fileForm.control} register={fileForm.register} />
        <DateRange label="Register Date" from="registerFrom" to="registerTo" control={fileForm.control} register={fileForm.register} />
        <DateRange label="Sent Date" from="sentFrom" to="sentTo" control={fileForm.control} register={fileForm.register} />
      </fieldset>
      <DataGrid
        caption="Claim files in storage"
        columns={fileGrid}
        rows={files}
        rowKey={(r) => `${r.caseNo}-${r.claimVersion}-${r.cartonNo}`}
        tall
        empty="No files. Enter the criteria and press Search."
      />
    </form>
  )

  return (
    <PageShell title="Storage Enquiry" subtitle="Cartons and the claim files kept in them.">
      <Tabs label="Storage enquiry" tabs={['Carton Details', 'Storage Details']} panels={[cartonPanel, filePanel]} active={tab} onChange={setTab} />
      <ActionBar label="Storage enquiry actions">
        <Button variant="primary" onClick={() => void (tab === 0 ? searchCartons() : searchFiles())} busy={busy} busyLabel="Working…">
          Search
        </Button>
        {tab === 1 && (
          <Button variant="ghost" onClick={() => void listing()} disabled={busy}>
            Listing
          </Button>
        )}
        <Button variant="ghost" onClick={print}>
          Print to File
        </Button>
        <Button variant="link" onClick={clear}>
          Clear
        </Button>
        <span className="spacer" />
        <Stat label="Records" value={tab === 0 ? cartons.length : files.length} />
        <Button variant="link" onClick={() => navigate('/')}>
          Close
        </Button>
      </ActionBar>
    </PageShell>
  )
}
