import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { formatDate } from '../../../../lib/format'
import { adjustmentApi, adjustmentKeys } from '../api/adjustmentApi'
import { SEARCH_FIELDS, SEARCH_MINIMUM_LENGTH } from '../constants'
import { text } from '../memberForm'

interface MemberSearchPanelProps {
  /** The membership shown below, used as the starting point of Pre / Next. */
  currentNumber: string | null
  onOpen: (membershipNo: string) => void
}

/** Membership No box, Go / Pre / Next and the search (desktop frmSearchMBM). */
export function MemberSearchPanel({ currentNumber, onOpen }: MemberSearchPanelProps) {
  const [numberInput, setNumberInput] = useState(currentNumber ?? '')
  const [searchBy, setSearchBy] = useState(SEARCH_FIELDS[0].code)
  const [searchText, setSearchText] = useState<string | null>(null)

  const search = useQuery({
    queryKey: adjustmentKeys.search(searchBy, searchText),
    enabled: searchText !== null,
    queryFn: () => adjustmentApi.search(searchText!, searchBy),
  })
  const navigate = useMutation({
    mutationFn: (direction: 'next' | 'prev') => adjustmentApi.navigate(currentNumber ?? numberInput, direction),
    onSuccess: (result) => open(result.membershipNo),
  })

  function open(membershipNo: string) {
    setNumberInput(membershipNo)
    setSearchText(null)
    onOpen(membershipNo)
  }

  const hasNumber = !!(currentNumber ?? numberInput.trim())
  return (
    <div className="registration">
      <fieldset>
        <FormField label="Membership No">
          <input value={numberInput} onChange={(e) => setNumberInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && numberInput.trim() && open(numberInput)} />
        </FormField>
        <div className="actions">
          <button type="button" disabled={!numberInput.trim()} onClick={() => open(numberInput)}>Go</button>
          <button type="button" disabled={navigate.isPending || !hasNumber} onClick={() => navigate.mutate('prev')}>Pre</button>
          <button type="button" disabled={navigate.isPending || !hasNumber} onClick={() => navigate.mutate('next')}>Next</button>
        </div>
        <FormField label="Search by">
          <select value={searchBy} onChange={(e) => setSearchBy(e.target.value)}>
            {SEARCH_FIELDS.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
          </select>
        </FormField>
        <div className="actions">
          <button type="button" disabled={numberInput.trim().length < SEARCH_MINIMUM_LENGTH} onClick={() => setSearchText(numberInput.trim())}>Search</button>
        </div>
      </fieldset>
      {navigate.isError && <p className="error" role="alert">{errorMessage(navigate.error)}</p>}
      {searchText !== null && search.isLoading && <p className="muted">Searching…</p>}
      {searchText !== null && search.isError && <p className="error" role="alert">{errorMessage(search.error)}</p>}
      {searchText !== null && search.data && (
        search.data.length === 0 ? <p className="muted">No record found!</p> : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>Membership No</th><th>Name</th><th>IC</th><th>Policy</th><th>Eff</th><th>Exp</th><th>Status</th><th>Group Company</th></tr></thead>
              <tbody>
                {search.data.map((r) => (
                  <tr key={text(r.MBMNumber)} className="clickable" tabIndex={0} onClick={() => open(text(r.MBMNumber))}
                    onKeyDown={(e) => e.key === 'Enter' && open(text(r.MBMNumber))}>
                    <td>{text(r.MBMNumber)}</td><td>{text(r.MBMName)}</td><td>{text(r.MBMIcBcPp)}</td><td>{text(r.MBMPolicyNo)}</td>
                    <td>{formatDate(r.MBMPayorEffDate)}</td><td>{formatDate(r.MBMPayorExpDate)}</td><td>{text(r.MBMStatus)}</td><td>{text(r.MBMGroupCompany)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
