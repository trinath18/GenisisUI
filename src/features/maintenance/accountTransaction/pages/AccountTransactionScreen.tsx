import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { saveCsv } from '../../../../lib/download'
import { formatMoney } from '../../../../lib/format'
import { notify } from '../../../../lib/notifyStore'
import { accountTransactionApi, accountTransactionKeys } from '../api/accountTransactionApi'
import type { AccountTransactionQuery, AccountTransactionRow } from '../types'
import { Button } from '../../../../components/Button'

const EMPTY: AccountTransactionQuery = {
  bodyPart: '',
  opcs: '',
  procedure: '',
  surgeonCategory: '',
  anaesthetistCategory: '',
  part: '',
  pageFrom: '',
  pageTo: '',
  cptCode: '',
  cptDescription: '',
}

const FIELDS: { key: keyof AccountTransactionQuery; label: string }[] = [
  { key: 'bodyPart', label: 'Body Part - MMA' },
  { key: 'procedure', label: 'MMA Desc' },
  { key: 'opcs', label: 'OPCS' },
  { key: 'surgeonCategory', label: 'Surg Cat' },
  { key: 'anaesthetistCategory', label: 'Ane Cat' },
  { key: 'part', label: 'MMA Part' },
  { key: 'pageFrom', label: 'Page' },
  { key: 'pageTo', label: 'To' },
  { key: 'cptCode', label: 'CPT Code' },
  { key: 'cptDescription', label: 'CPT Desc' },
]

const HEADINGS = [
  'Main Body Part Code',
  'OPCS',
  'Procedures',
  "Surg's Cat",
  "Anae's Cat",
  "Surg's Fees",
  "Anae's Fees",
  'Part A Fees',
  'Page',
  'Part',
  'CPT Code',
  'CPT Desc',
] as const

const money = (value: number | null) => (value === null ? '' : formatMoney(value))

const cells = (r: AccountTransactionRow): string[] => [
  r.bodyPart ?? '',
  r.opcs ?? '',
  r.procedureDescription ?? '',
  r.surgeonCategory ?? '',
  r.anaesthetistCategory ?? '',
  money(r.surgeonFee),
  money(r.anaesthetistFee),
  r.partACost ?? '',
  r.page ?? '',
  r.part ?? '',
  r.cptCode ?? '',
  r.cptDescription ?? '',
]

/** Maintenance > Account Transaction (legacy frmMMASchedule, "MMA Schedule of Fees"): a read-only search of the schedule. */
export function AccountTransactionScreen() {
  const [form, setForm] = useState(EMPTY)
  const [query, setQuery] = useState<AccountTransactionQuery | null>(null)
  const list = useQuery({
    queryKey: accountTransactionKeys.search(query),
    enabled: query !== null,
    queryFn: () => accountTransactionApi.search(query!),
  })
  const rows = list.data?.rows ?? []

  const search = (e: FormEvent) => {
    e.preventDefault()
    setQuery({ ...form })
  }
  const clear = () => {
    setForm(EMPTY)
    setQuery(null)
  }
  const print = () => {
    if (rows.length === 0) return notify('Record not found', 'info')
    saveCsv([[...HEADINGS], ...rows.map(cells)], 'MMAScheduleOfFees.csv')
  }

  return (
    <section>
      <h2>MMA Schedule of Fees</h2>
      <form className="registration" onSubmit={search}>
        <fieldset>
          <legend>Criteria</legend>
          {FIELDS.map((f) => (
            <FormField key={f.key} label={f.label}>
              <input value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
            </FormField>
          ))}
          <div className="actions">
            <Button variant="primary" type="submit" disabled={list.isFetching}>
              Search
            </Button>
            <Button variant="link" onClick={clear}>
              Clear
            </Button>
            <Button variant="ghost" disabled={rows.length === 0} onClick={print}>
              Print
            </Button>
          </div>
        </fieldset>
      </form>
      {list.isLoading && <p className="muted">Searching…</p>}
      {list.isError && (
        <p className="error" role="alert">
          {errorMessage(list.error)}
        </p>
      )}
      {list.data && rows.length === 0 && <p className="muted">Record not found</p>}
      {list.data?.truncated && <p className="warning">Only the first 5000 rows are shown. Narrow the criteria to see the rest.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                {HEADINGS.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                // Schedule rows have no unique key (an OPCS code can repeat across body parts); the list is never reordered.
                <tr key={`${r.opcs}|${r.bodyPart}|${i}`}>
                  {cells(r).map((value, c) => (
                    <td key={HEADINGS[c]}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
