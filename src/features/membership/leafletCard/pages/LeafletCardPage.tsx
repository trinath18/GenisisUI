import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { CodeSelect } from '../../../../components/common/CodeSelect'
import { FormField } from '../../../../components/common/FormField'
import { saveCsv } from '../../../../lib/download'
import { formatDate } from '../../../../lib/format'
import { leafletCardApi, leafletCardKeys } from '../api/leafletCardApi'
import type { CardExport, CodeName, LeafletCardCriteria } from '../types'
import { Button } from '../../../../components/Button'

const LOOKUPS_STALE_MS = 10 * 60 * 1000
const EMPTY_FORM = { bordxDateFrom: '', bordxDateTo: '', payorCode: '', batchNo: '', healthCode: '' }
type Form = typeof EMPTY_FORM

const options = (list: CodeName[] | undefined) => (list ?? []).map((o) => ({ code: o.code, name: o.name ?? o.code }))
const toCriteria = (f: Form): LeafletCardCriteria => ({
  bordxDateFrom: f.bordxDateFrom || null,
  bordxDateTo: f.bordxDateTo || null,
  payorCode: f.payorCode,
  healthCode: f.healthCode,
  batchNo: f.batchNo === '' ? null : Number(f.batchNo),
})

/** ExpMBMPrintingToExcel: payor, bordx date and file name above numbered card rows. */
function saveCardExport(data: CardExport) {
  saveCsv(
    [
      [data.payorName],
      [formatDate(data.bordxDate)],
      [data.fileName],
      [],
      ['No', 'Name', 'IC No', 'Policy No', 'Member No', 'Plan', 'Expiry Date'],
      ...data.cards.map((c, i) => [i + 1, c.name ?? '', c.icBcPp ?? '', c.policyNo ?? '', c.cardNumber, c.planCode ?? '', formatDate(c.expiryDate)]),
    ],
    `${data.fileName}.csv`,
  )
}

/** Membership &gt; Leaflet &amp; Card (legacy frmMainReport, Leaflet and Card Printing tabs). */
export function LeafletCardPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (field: keyof Form) => (value: string) => setForm((f) => ({ ...f, [field]: value }))
  const lookups = useQuery({ queryKey: leafletCardKeys.lookups, queryFn: leafletCardApi.getLookups, staleTime: LOOKUPS_STALE_MS })

  const search = useMutation({ mutationFn: (f: Form) => leafletCardApi.search(toCriteria(f)) })
  const leaflets = useMutation({ mutationFn: (f: Form) => leafletCardApi.openLeaflets(toCriteria(f)) })
  const cards = useMutation({ mutationFn: (f: Form) => leafletCardApi.openCards(toCriteria(f)) })
  const cardExport = useMutation({ mutationFn: (f: Form) => leafletCardApi.getCardExport(toCriteria(f)), onSuccess: saveCardExport })
  const busy = search.isPending || leaflets.isPending || cards.isPending || cardExport.isPending
  const failure = [search, leaflets, cards, cardExport].find((m) => m.isError)?.error

  if (lookups.isLoading) return <p className="muted">Loading…</p>
  if (lookups.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(lookups.error)}
      </p>
    )
  const rows = search.data?.rows ?? []
  return (
    <section>
      <h2>Leaflet &amp; Card</h2>
      <div className="registration">
        <fieldset>
          <legend>Enter Criteria For Searching</legend>
          <FormField label="Bordereaux Date From *">
            <input type="date" value={form.bordxDateFrom} onChange={(e) => set('bordxDateFrom')(e.target.value)} />
          </FormField>
          <FormField label="Bordereaux Date To *">
            <input type="date" value={form.bordxDateTo} onChange={(e) => set('bordxDateTo')(e.target.value)} />
          </FormField>
          <FormField label="Insurer's Code *">
            <CodeSelect value={form.payorCode} onChange={set('payorCode')} options={options(lookups.data?.payors)} />
          </FormField>
          <FormField label="Batch No *">
            <input value={form.batchNo} inputMode="numeric" onChange={(e) => set('batchNo')(e.target.value.replace(/\D/g, ''))} />
          </FormField>
          <FormField label="Health Type *">
            <CodeSelect value={form.healthCode} onChange={set('healthCode')} options={options(lookups.data?.healthCodes)} />
          </FormField>
          <div className="actions">
            <Button variant="ghost" disabled={busy} onClick={() => search.mutate({ ...form })}>
              Search
            </Button>
            <Button
              variant="link"
              disabled={busy}
              onClick={() => {
                setForm(EMPTY_FORM)
                search.reset()
              }}
            >
              Clear
            </Button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Print</legend>
          <p className="muted">
            PDFs open in a new tab for printing. Printed / reprinted status is not tracked (the desktop's MBMPrinting table does not exist in this database).
          </p>
          <div className="actions">
            <Button variant="ghost" busy={leaflets.isPending} busyLabel="Preparing…" disabled={busy} onClick={() => leaflets.mutate({ ...form })}>
              {' '}
              Leaflets (PDF)
            </Button>
            <Button variant="ghost" busy={cards.isPending} busyLabel="Preparing…" disabled={busy} onClick={() => cards.mutate({ ...form })}>
              {' '}
              Cards (PDF)
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => cardExport.mutate({ ...form })}>
              Card Export (CSV)
            </Button>
          </div>
        </fieldset>
      </div>
      {failure !== undefined && (
        <p className="error" role="alert">
          {errorMessage(failure)}
        </p>
      )}
      {search.data && rows.length === 0 && <p className="muted">Record not found !</p>}
      {search.data?.truncated && <p className="warning">Only the first 5000 memberships are listed.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Payor Code</th>
                <th>Membership No</th>
                <th>Bordereaux Date</th>
                <th>Policy No</th>
                <th>Health Type</th>
                <th>Batch No</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.membershipNo}>
                  <td>{r.payorCode}</td>
                  <td>{r.membershipNo}</td>
                  <td>{formatDate(r.bordxDate)}</td>
                  <td>{r.policyNo ?? ''}</td>
                  <td>{r.healthCode ?? ''}</td>
                  <td>{r.batchNo ?? ''}</td>
                  <td>{r.name ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
