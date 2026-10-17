/** The columns of a worksheet row the tick rules look at. */
export interface TickableWorksheet {
  dod: string
  hospital: string
  claimability: string
  hltType: string
  insuredType: string
  groupCompany: string
}

/** The message shown when a ticked worksheet has no scanned documents (the check itself runs on the server). */
export const NO_DOCUMENTS = 'Please ensure scanned documents are in system!'

const isGroup = (r: TickableWorksheet) => r.hltType.trim() === 'N' && ['G', 'H'].includes(r.insuredType.trim())

/** Group worksheets (health type N, insured type G or H) are exempt from the scanned-document rule. */
export const needsDocuments = (r: TickableWorksheet) => !isGroup(r)

/**
 * lstWorksheetTrackList_ItemCheck: why a worksheet may not be ticked, or null. The API applies the same rules again when the bordx is generated.
 * The claimability test keeps the desktop's literal "N" (two-letter codes such as NN never match it).
 */
export function selectionProblem(r: TickableWorksheet): string | null {
  if (!r.dod.trim()) return 'Date of Discharge is Empty.'
  if (!r.hospital.trim()) return 'Hospital cannot be empty!'
  if (r.claimability.trim() === 'N') return 'Claimability is Not Decided!'
  if (isGroup(r) && !r.groupCompany.trim()) return 'Group Company cannot be empty!'
  return null
}
