import type { JournalLine } from './types'

/** The invoice a journal line belongs to (case number - claim version). */
export const invoiceKey = (line: Pick<JournalLine, 'invoiceCaseNo' | 'invoiceVersion'>) => `${line.invoiceCaseNo}-${line.invoiceVersion}`

/** A unique key per grid line: the posting list has two lines per invoice. */
export const lineKey = (line: JournalLine, position: number) => `${invoiceKey(line)}#${position}`

/** Grid rows with their unique key. */
export const keyedLines = (lines: JournalLine[]) => lines.map((line, i) => ({ ...line, key: lineKey(line, i) }))

/**
 * lstMBMInvList_ItemCheck: ticking or unticking one line of an invoice does the same to the other line of the pair.
 * `previous` / `next` are sets of line keys; the result has whole pairs only.
 */
export function pairSelection(
  lines: { key: string; invoiceCaseNo: string; invoiceVersion: string }[],
  previous: ReadonlySet<string>,
  next: ReadonlySet<string>,
) {
  const byInvoice = new Map<string, string[]>()
  for (const l of lines) byInvoice.set(invoiceKey(l), [...(byInvoice.get(invoiceKey(l)) ?? []), l.key])
  const result = new Set<string>()
  for (const keys of byInvoice.values()) {
    const changed = keys.find((k) => previous.has(k) !== next.has(k))
    const on = changed ? next.has(changed) : keys.some((k) => previous.has(k))
    if (on) keys.forEach((k) => result.add(k))
  }
  return result
}

/** The ticked invoices, once each, in list order. */
export function pickedInvoices(lines: { key: string; invoiceCaseNo: string; invoiceVersion: string }[], checked: ReadonlySet<string>) {
  const seen = new Set<string>()
  const picks: { caseNo: string; claimVersion: string }[] = []
  for (const l of lines) {
    if (!checked.has(l.key) || seen.has(invoiceKey(l))) continue
    seen.add(invoiceKey(l))
    picks.push({ caseNo: l.invoiceCaseNo, claimVersion: l.invoiceVersion })
  }
  return picks
}

/** CmdPost_Click's screen checks before asking for confirmation, in the desktop's order (the API repeats them). */
export function postProblem(input: { picked: number; invoiceDateTo: string; bordxStatus: string; posted: boolean; accPeriod: string }): string | null {
  if (input.picked === 0) return 'Please select the record'
  if (!input.invoiceDateTo) return 'Please Enter Invoice Date(To)'
  if (input.bordxStatus === '0') return 'Please change Bordx Status'
  if (input.posted) return 'Record(s) has been posted ! '
  if (!input.accPeriod.trim()) return 'Please Keyin for Accounting Period ! '
  return null
}
