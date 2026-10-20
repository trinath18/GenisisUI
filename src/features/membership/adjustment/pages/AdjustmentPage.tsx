import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { adjustmentApi, adjustmentKeys } from '../api/adjustmentApi'
import { AdjustmentEditor } from '../components/AdjustmentEditor'
import { MemberSearchPanel } from '../components/MemberSearchPanel'

const LOOKUPS_STALE_MS = 10 * 60_000

/** Membership &gt; Adjustment (legacy frmNewMBMAdjustment). Load a member, choose an endorsement type, make the change, save. */
export function AdjustmentPage() {
  const [membershipNo, setMembershipNo] = useState<string | null>(null)
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

  const open = (number: string) => {
    setMembershipNo(number.trim().toUpperCase())
    setReloadCount((n) => n + 1)
    setSavedMessage(null)
  }

  if (lookups.isLoading) return <p className="muted">Loading…</p>
  if (lookups.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(lookups.error)}
      </p>
    )

  return (
    <section>
      <h2>Membership Adjustment</h2>
      <MemberSearchPanel currentNumber={membershipNo} onOpen={open} />
      {loaded.isError && (
        <p className="error" role="alert">
          {errorMessage(loaded.error)}
        </p>
      )}
      {loaded.isLoading && <p className="muted">Loading…</p>}
      {loaded.data && membershipNo && (
        <AdjustmentEditor
          key={`${membershipNo}-${loaded.dataUpdatedAt}-${reloadCount}`}
          membershipNo={membershipNo}
          original={loaded.data}
          lookups={lookups.data!}
          onReload={() => {
            setReloadCount((n) => n + 1)
            setSavedMessage(null)
          }}
          savedMessage={savedMessage}
          onSavedMessageChange={setSavedMessage}
        />
      )}
    </section>
  )
}
