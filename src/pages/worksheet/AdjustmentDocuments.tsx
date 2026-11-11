import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { notify } from '../../lib/notifyStore'
import { GlDialog } from '../case/CaseAdjustmentDialogs'
import { LetterModal } from '../case/CaseLetters'
import type { LetterResult } from '../case/CaseLetters'
import { api, errorMessage } from '../../api/client'
import { finalLgEndpoints } from './adjustmentRules'
import { canMakeNote } from './documentRules'
import type { ExcessLetter, WorksheetNote } from './documentRules'
import type { EnquiryResult } from './enquiryRules'
import { ExcessLetterModal, NoteModal } from './WorksheetDocuments'

/**
 * The document buttons of Worksheet Adjustment: Credit Note and Debit Note (enabled by what is due: Medix owes the member, or the member owes Medix), and Exc Letter.
 * A debit note without a number is given one when it is made; the Excess letter marks the case as having had it.
 */
export function AdjustmentDocuments({ result }: { result: EnquiryResult }) {
  const cas = result.header.caseNo
  const version = Number(result.selectedVersion)
  const base = `/api/worksheet/adjustment/${encodeURIComponent(cas)}/${version}`
  const queryClient = useQueryClient()
  const [note, setNote] = useState<WorksheetNote | null>(null)
  const [letter, setLetter] = useState<ExcessLetter | null>(null)
  const [busy, setBusy] = useState<'debit' | 'excess' | null>(null)
  const [finalOpen, setFinalOpen] = useState(false)
  const [lg, setLg] = useState<LetterResult | null>(null)
  const due = useQuery({
    queryKey: ['worksheet-note', cas, version],
    queryFn: async () => (await api.get<WorksheetNote>(`${base}/note`)).data,
    retry: false,
  })

  async function make<T>(kind: 'debit' | 'excess', url: string, show: (x: T) => void) {
    setBusy(kind)
    try {
      show((await api.post<T>(`${base}/${url}`)).data)
      await queryClient.invalidateQueries({ queryKey: ['worksheet-note'] })
    } catch (e) {
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Button variant="ghost" disabled={!canMakeNote(due.data?.kind, 'Credit')} onClick={() => due.data && setNote(due.data)}>
        Credit Note
      </Button>
      <Button
        variant="ghost"
        disabled={!canMakeNote(due.data?.kind, 'Debit')}
        busy={busy === 'debit'}
        busyLabel="Making…"
        onClick={() => make<WorksheetNote>('debit', 'debit-note', setNote)}
      >
        Debit Note
      </Button>
      <Button variant="ghost" busy={busy === 'excess'} busyLabel="Making…" onClick={() => make<ExcessLetter>('excess', 'excess-letter', setLetter)}>
        Exc Letter
      </Button>
      <Button variant="ghost" onClick={() => setFinalOpen(true)}>
        Final LG
      </Button>
      {finalOpen && (
        <GlDialog
          cas={cas}
          request={() => ({})}
          defaultAmount={result.summary.payableToHospital.toFixed(2)}
          endpoints={finalLgEndpoints(cas, version)}
          final
          onIssued={(r) => {
            setFinalOpen(false)
            setLg(r.letter)
            notify(`Final LG ${r.lgNumber} issued`, 'success')
          }}
          onClose={() => setFinalOpen(false)}
        />
      )}
      {lg && <LetterModal letter={lg} onClose={() => setLg(null)} />}
      {note && <NoteModal note={note} onClose={() => setNote(null)} />}
      {letter && <ExcessLetterModal letter={letter} onClose={() => setLetter(null)} />}
    </>
  )
}
