import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { reinstatementApi, reinstatementKeys } from '../api/reinstatementApi'
import { ReinstatementForm, ReinstatementSummary } from '../components/ReinstatementForm'
import type { ReinstatementResult } from '../types'

/** Membership &gt; Member Reinstatement (legacy frmMBMReintstatement). */
export function ReinstatementPage() {
  const queryClient = useQueryClient()
  const [numberInput, setNumberInput] = useState('')
  const [membershipNo, setMembershipNo] = useState<string | null>(null)
  const [result, setResult] = useState<ReinstatementResult | null>(null)

  const membership = useQuery({
    queryKey: reinstatementKeys.member(membershipNo),
    enabled: membershipNo !== null,
    queryFn: () => reinstatementApi.get(membershipNo!),
  })

  function search() {
    const number = numberInput.trim()
    if (!number) return
    setResult(null)
    setMembershipNo(number)
    void queryClient.invalidateQueries({ queryKey: reinstatementKeys.member(number) })
  }

  function reinstated(done: ReinstatementResult) {
    setResult(done)
    void queryClient.invalidateQueries({ queryKey: reinstatementKeys.member(membershipNo) })
  }

  return (
    <section>
      <h2>Member Reinstatement</h2>
      <div className="registration">
        <fieldset>
          <FormField label="Membership No">
            <input value={numberInput} onChange={(e) => setNumberInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && search()} />
          </FormField>
          <div className="actions">
            <button type="button" disabled={!numberInput.trim()} onClick={search}>
              Search
            </button>
          </div>
        </fieldset>
      </div>
      {result && <ReinstatementSummary result={result} />}
      {membership.isLoading && <p className="muted">Loading…</p>}
      {membership.isError && (
        <p className="error" role="alert">
          {errorMessage(membership.error)}
        </p>
      )}
      {membership.data && (
        <ReinstatementForm key={`${membership.data.member.membershipNo}:${membership.dataUpdatedAt}`} view={membership.data} onReinstated={reinstated} />
      )}
    </section>
  )
}
