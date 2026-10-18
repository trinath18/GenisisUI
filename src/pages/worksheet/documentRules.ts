// Pure rules of the documents of Worksheet > Worksheet Adjustment: the credit / debit note (legacy cmdCredit_Click / cmdDebit_Click, Excel templates) and the Excess letter
// (cmdExcLetter_Click, Word templates). The templates are not in the source package; these are the fields they were filled with.

export interface WorksheetNote {
  kind: 'Credit' | 'Debit' | 'None'
  number: string
  date: string | null
  amount: number
  caseNo: string
  version: number
  patientName: string
  memberNo: string
  memberName: string
  groupCompany: string
  companyPlan: boolean
  hospital: string
  admitted: string | null
  disability: string
  address1: string
  address2: string
  address3: string
  postCode: string
  city: string
  state: string
  remarks: string
}

export interface ExcessItem {
  label: string
  amount: number
}

export interface ExcessLetter {
  template: 'MAS' | 'Etiqa' | 'Medix'
  excessNo: string
  excessDate: string | null
  invoiceNo: string
  invoiceAmount: number
  caseNo: string
  principalName: string
  patientName: string
  patientIc: string
  planCode: string
  staffNo: string
  costCenter: string
  department: string
  bordxNo: string
  admitted: string | null
  discharged: string | null
  hospital: string
  hospitalContact: string
  hospitalFax: string
  items: ExcessItem[]
  limitExceeded: number
  coPayment: number
  undertakenExcess: number
  totalExcess: number
  othersDescription: string
  issuedOn: string
}

export const noteTitle = (n: Pick<WorksheetNote, 'kind'>) => (n.kind === 'Credit' ? 'CREDIT NOTE' : 'DEBIT NOTE')

/** The note is addressed to the patient; a debit note of a plan billed to the company goes to the group company (the desktop's DebitNoteCompany template). */
export const noteAddressee = (n: Pick<WorksheetNote, 'kind' | 'companyPlan' | 'groupCompany' | 'patientName'>) =>
  n.kind === 'Debit' && n.companyPlan && n.groupCompany.trim() !== '' ? n.groupCompany : n.patientName

/** The address as printed: the three lines, then post code, city and state on one line; lines with nothing in them are left out. */
export function noteAddress(n: Pick<WorksheetNote, 'address1' | 'address2' | 'address3' | 'postCode' | 'city' | 'state'>): string[] {
  const place = [n.postCode, n.city, n.state]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' ')
  return [n.address1, n.address2, n.address3, place].map((x) => x.trim()).filter(Boolean)
}

/** cmdDebit / cmdCredit are enabled by what is due: a credit note when Medix owes the member, a debit note when the member owes Medix. */
export const canMakeNote = (kind: WorksheetNote['kind'] | undefined, wanted: 'Credit' | 'Debit') => kind === wanted

/** The Excess letter shows the total only when there is one. */
export const showsTotalExcess = (letter: Pick<ExcessLetter, 'totalExcess'>) => letter.totalExcess > 0

/** The letter heading follows the template the plan selects. */
export const excessHeading = (template: ExcessLetter['template']) =>
  template === 'MAS' ? 'EXCESS PAYMENT NOTICE (MAS)' : template === 'Etiqa' ? 'EXCESS PAYMENT NOTICE (ETIQA)' : 'EXCESS PAYMENT NOTICE'
