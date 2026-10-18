import { useState } from 'react'
import { DataGrid } from '../../components/DataGrid'
import type { GridColumn } from '../../components/DataGrid'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { notify } from '../../lib/notifyStore'
import { api, errorMessage } from '../../api/client'
import { isoToDmy, S } from '../case/caseShared'
import { searchKindOptions } from './enquiryRules'
import type { EnquiryCaseRow } from './enquiryRules'

const columns: GridColumn<EnquiryCaseRow>[] = [
  { key: 'caseNo', label: 'Case No' },
  { key: 'memberNo', label: 'Member No' },
  { key: 'patientName', label: 'Patient' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'admitted', label: 'DOA', value: (r) => isoToDmy(r.admitted), sortBy: (r) => S(r.admitted) },
  { key: 'discharged', label: 'DOD', value: (r) => isoToDmy(r.discharged), sortBy: (r) => S(r.discharged) },
  { key: 'policyNo', label: 'Policy No' },
  { key: 'payor', label: 'Payor' },
  { key: 'caseStatus', label: 'Status' },
  { key: 'versions', label: 'Worksheets', align: 'right' },
]

/** cmdSearchCase_Click (frmCASList): find a case by number, member, patient name, I/C or policy and pick it. */
export function EnquiryCaseDialog({ onPick, onClose }: { onPick: (caseNo: string) => void; onClose: () => void }) {
  const [by, setBy] = useState('number')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<EnquiryCaseRow[]>([])
  const [busy, setBusy] = useState(false)

  async function search() {
    if (q.trim().length < 2) return notify('Enter at least 2 characters.', 'error')
    setBusy(true)
    try {
      const { data } = await api.get<EnquiryCaseRow[]>('/api/worksheet/enquiry/cases', { params: { by, q: q.trim() } })
      if (data.length === 0) notify('No record found!', 'error')
      else if (data.length === 1) onPick(data[0].caseNo)
      else setRows(data)
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Case Search" onClose={onClose} wide>
      <div className="search-inline">
        <select value={by} onChange={(e) => setBy(e.target.value)} aria-label="Search by">
          {searchKindOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={q}
          placeholder="Search text"
          aria-label="Search text"
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Button variant="primary" onClick={search} busy={busy} busyLabel="Searching…">
          Search
        </Button>
      </div>
      <DataGrid caption="Cases" columns={columns} rows={rows} rowKey={(r) => r.caseNo} onSelect={(r) => onPick(r.caseNo)} empty="Enter a search above." />
    </Modal>
  )
}
