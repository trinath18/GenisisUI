import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { adjustmentApi, adjustmentKeys } from '../api/adjustmentApi'
import { AdjustmentEditor } from '../components/AdjustmentEditor'
import { MemberSearchPanel } from '../components/MemberSearchPanel'

const LOOKUPS_STALE_MS = 10 * 60_000

interface AdjustmentPageProps {
  title?: string
  /** Checked before a membership is opened; resolves to a message when it may not be (Temp MBM Adj: temporary payors only). */
  canOpen?: (membershipNo: string) => Promise<string | null>
}

/** Membership &gt; Adjustment (legacy frmNewMBMAdjustment). Load a member, choose an endorsement type, make the change, save. */
export function AdjustmentPage({ title = 'Membership Adjustment', canOpen }: AdjustmentPageProps = {}) {
  const [membershipNo, setMembershipNo] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  /** Bumped by Clear so the editor starts again from the stored values. */
  const [reloadCount, setReloadCount] = useState(0)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const lookups = useQuery({ queryKey: adjustmentKeys.lookups, queryFn: adjustmentApi.getLookups, staleTime: LOOKUPS_STALE_MS })
  const loaded = useQuery({
    queryKey: adjustmentKeys.member(membershipNo),
    enabled: membershipNo !== null,
    queryFn: () => adjustmentApi.load(membershipNo!),
    // The editor is filled from this load, so a background refetch would throw away unsaved edits.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

  const open = async (number: string) => {
    const normalized = number.trim().toUpperCase()
    const refusal = canOpen ? await canOpen(normalized) : null
    setRefused(refusal)
    if (refusal) {
      setMembershipNo(null)
      return
    }
    setMembershipNo(normalized)
    setReloadCount((n) => n + 1)
    setSavedMessage(null)
  }

  if (lookups.isLoading) return <p className="muted">Loading…</p>
  if (lookups.isError) return <p className="error" role="alert">{errorMessage(lookups.error)}</p>

  return (
    <section>
      <h2>{title}</h2>
      <MemberSearchPanel currentNumber={membershipNo} onOpen={(number) => void open(number)} />
      {refused && <p className="error" role="alert">{refused}</p>}
      {loaded.isError && <p className="error" role="alert">{errorMessage(loaded.error)}</p>}
      {loaded.isLoading && <p className="muted">Loading…</p>}
      {loaded.data && membershipNo && (
        <AdjustmentEditor
          key={`${membershipNo}-${loaded.dataUpdatedAt}-${reloadCount}`}
          membershipNo={membershipNo}
          original={loaded.data}
          lookups={lookups.data!}
          onReload={() => { setReloadCount((n) => n + 1); setSavedMessage(null) }}
          savedMessage={savedMessage}
          onSavedMessageChange={setSavedMessage}
        />
      )}
    </section>
  )
}
