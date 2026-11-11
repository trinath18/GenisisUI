import { describe, expect, it } from 'vitest'
import {
  listingColumns,
  listingRows,
  PAYMENT_NOTE,
  recoveryDefaults,
  recoveryListColumns,
  recoveryParams,
  recoveryProblem,
  shownRecovery,
} from './printRecoveryRules'
import type { RecoveryResult, RecoveryRow } from './printRecoveryRules'

const row = (over: Partial<RecoveryRow> = {}): RecoveryRow =>
  ({
    caseNo: 'AB00001',
    claimVersion: 2,
    patientName: 'A PATIENT',
    patientIc: '800101-01-1234',
    memberNo: 'ABHA1*01',
    memberName: 'A MEMBER',
    memberIc: '700101-01-0000',
    employeeNo: 'E1',
    deptCode: 'D1',
    department: 'FINANCE',
    costCenter: 'CC1',
    planCode: 'PL1',
    dateAdmitted: '2021-05-01T00:00:00',
    dateDischarged: '2021-05-03T00:00:00',
    claimOpenDate: '2021-05-10T00:00:00',
    invoiceDate: '2021-05-04T00:00:00',
    hospital: 'A HOSPITAL',
    diagnosis1: 'D1',
    diagnosis2: null,
    diagnosis3: 'D3',
    debitNoteNo: 'DN1',
    bordxAmount: 1000,
    recovery: -150.5,
    actualAmount: 1200,
    bordxNo: 'B1',
    payorName: 'A PAYOR',
    policyNo: 'G1-000',
    payorEffDate: '2021-01-01T00:00:00',
    payorExpDate: '2021-12-31T00:00:00',
    ...over,
  }) as RecoveryRow

describe('Print Recovery checks', () => {
  it('needs a group company', () => {
    expect(recoveryProblem({ company: ' ' })).toBe('Please select Group Company')
    expect(recoveryProblem({ company: 'ACME' })).toBeNull()
  })

  it('sends the company and the dates as ISO days, leaving blanks out', () => {
    expect(recoveryParams({ ...recoveryDefaults, company: ' ACME ', bordxFrom: ' B1 ', openFrom: '01/02/2021' })).toEqual({
      company: 'ACME',
      bordxFrom: 'B1',
      bordxTo: undefined,
      bordxDateFrom: undefined,
      bordxDateTo: undefined,
      openFrom: '2021-02-01',
      openTo: undefined,
    })
  })

  it('shows the recovery the way the desktop did: the negative amount times -1', () => {
    expect([shownRecovery(-150.5), shownRecovery(0), shownRecovery(null)]).toEqual([150.5, 0, null])
  })
})

describe('Print Recovery list and listing', () => {
  it('lists case-version, patient, member, hospital and the amounts', () => {
    expect(recoveryListColumns.map((c) => c.label)).toEqual(['Case No', 'Patient', 'Member No', 'Hospital', 'Actual Amt', 'Recovery', 'Bordx Amt', 'Bordx Ref'])
    expect(recoveryListColumns.map((c) => c.value(row()))).toEqual(['AB00001-2', 'A PATIENT', 'ABHA1*01', 'A HOSPITAL', '1,200.00', '150.50', '1,000.00', 'B1'])
  })

  it('has a layout for each report type', () => {
    expect(listingColumns('1')).toHaveLength(17)
    expect(listingColumns(null)).toHaveLength(17)
    expect(listingColumns('2').map((c) => c.label)).toContain('Debit Note No')
    expect(listingColumns('2')).toHaveLength(15)
  })

  it('writes the header, the numbered rows, the totals and the payment note', () => {
    const result: RecoveryResult = {
      reportType: '1',
      rows: [row(), row({ caseNo: 'AB00002', claimVersion: 1, recovery: -10, bordxAmount: 50, actualAmount: 60 })],
      totalBordxAmount: 1050,
      totalRecovery: -160.5,
      totalActual: 1260,
      truncated: false,
    }
    const lines = listingRows(result, '30/10/2026')
    expect(lines.slice(0, 4)).toEqual([
      ['Payor', 'A PAYOR'],
      ['Policy No', 'G1-000'],
      ['Period', '01/01/2021 To 31/12/2021'],
      ['Date', '30/10/2026'],
    ])
    expect(lines[5][0]).toBe('No')
    expect(lines[6].slice(0, 3)).toEqual(['1', 'AB00001-2', 'A PATIENT'])
    expect(lines[7][0]).toBe('2')
    const totals = lines.at(-3)!
    expect(totals.slice(-3)).toEqual(['1,050.00', '160.50', '1,260.00'])
    expect(lines.at(-1)).toEqual([PAYMENT_NOTE])
  })
})
