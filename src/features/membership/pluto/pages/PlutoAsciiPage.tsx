import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { FormField } from '../../../../components/common/FormField'
import { plutoApi, plutoKeys } from '../api/plutoApi'
import { ASCII_GENERATED_MESSAGE, HEALTH_CODES, PAYORS_STALE_MS } from '../constants'

/** Membership &gt; Generate Membership ASCII (Pluto) (legacy frmMembershipASCIIPluto). */
export function PlutoAsciiPage() {
  const [healthCode, setHealthCode] = useState('')
  const [payorCode, setPayorCode] = useState('')
  const [bordxDate, setBordxDate] = useState('')

  const payors = useQuery({
    queryKey: plutoKeys.payors(healthCode),
    enabled: healthCode !== '',
    queryFn: () => plutoApi.getPayors(healthCode),
    staleTime: PAYORS_STALE_MS,
  })
  const generate = useMutation({ mutationFn: () => plutoApi.exportAscii({ healthCode, payorCode, bordxDate }) })

  return (
    <section>
      <h2>Membership ASCII (Pluto)</h2>
      <div className="registration">
        <fieldset>
          <legend>File</legend>
          <FormField label="Health Type *">
            <select value={healthCode} onChange={(e) => { setHealthCode(e.target.value); setPayorCode('') }}>
              <option value="">(choose)</option>
              {HEALTH_CODES.map((h) => <option key={h.code} value={h.code}>{h.name}</option>)}
            </select>
          </FormField>
          <FormField label="Payor *">
            <select value={payorCode} disabled={!payors.data} onChange={(e) => setPayorCode(e.target.value)}>
              <option value="">{payors.isLoading ? 'Loading…' : '(choose)'}</option>
              {payors.data?.map((p) => <option key={p.code} value={p.code}>{p.code} - {p.name ?? ''}</option>)}
            </select>
          </FormField>
          <FormField label="Bordx Date *">
            <input type="date" value={bordxDate} onChange={(e) => setBordxDate(e.target.value)} />
          </FormField>
          <div className="actions">
            <button type="button" disabled={generate.isPending} onClick={() => generate.mutate()}>
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </fieldset>
      </div>
      {payors.isError && <p className="error" role="alert">{errorMessage(payors.error)}</p>}
      {generate.isError && <p className="error" role="alert">{errorMessage(generate.error)}</p>}
      {generate.data && (
        <p className="success" role="status">
          {ASCII_GENERATED_MESSAGE} {generate.data.fileName}: Total Principal {generate.data.principals ?? 0}, Total Supplementary{' '}
          {generate.data.supplementaries ?? 0}
        </p>
      )}
    </section>
  )
}
