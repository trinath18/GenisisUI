import { describe, expect, it } from 'vitest'
import {
  collectedByText,
  disabilityText,
  joined,
  moneyOrDash,
  notCoveredRows,
  showsBordxInd,
  summaryRows,
  topupGrid,
  versionOptions,
  worksheetExport,
} from './enquiryRules'
import type { EnquiryDiagnosis, EnquiryInvoice, EnquiryResult, EnquirySummary } from './enquiryRules'
import { blockRows } from '../../lib/exportSpec'

describe('versionOptions (cboVersion)', () => {
  it('lists each version as n and Mn, then Master', () => {
    expect(versionOptions([{ claimVersion: 1 }, { claimVersion: 2 }]).map((o) => o.value)).toEqual(['1', 'M1', '2', 'M2', 'Master'])
  })
  it('offers version 1 and Master before a case is loaded', () => {
    expect(versionOptions([]).map((o) => o.value)).toEqual(['1', 'M1', 'Master'])
  })
})

describe('moneyOrDash', () => {
  it('shows a dash for nothing or zero, as the grid did', () => {
    expect(moneyOrDash(null)).toBe('-')
    expect(moneyOrDash(0)).toBe('-')
    expect(moneyOrDash(1234.5)).toBe('1,234.50')
    expect(moneyOrDash(-50)).toBe('-50.00')
  })
})

const invoice = (over: Partial<EnquiryInvoice>) =>
  ({
    preHospitalOver60: null,
    preHospitalGpFee: null,
    preHospitalMedicine: null,
    preHospitalMedicalReport: null,
    preHospitalSpecialistFee: null,
    postHospitalOver31Days: null,
    postHospitalDifferentPhysician: null,
    notCoveredOthers: null,
    ...over,
  }) as EnquiryInvoice

describe('notCoveredRows (FGridNCover)', () => {
  it("has the desktop's eight items, each added up over the invoices", () => {
    const rows = notCoveredRows([
      invoice({ preHospitalOver60: 10, notCoveredOthers: 1 }),
      invoice({ preHospitalOver60: 5.5, preHospitalGpFee: 20, notCoveredOthers: 2 }),
    ])
    expect(rows.map((r) => r.label)).toEqual([
      'Pre-Hosp > 60',
      'Pre-Hosp GP Fee',
      'Pre-Hosp Medicine',
      'Pre-Hosp Medical Report',
      'Pre-Hosp Subsequent Specialist Fee',
      'Post-Hosp More Than 31 Days',
      'Post-Hosp Different Physician',
      'Others',
    ])
    expect(rows[0].amount).toBe(15.5)
    expect(rows[1].amount).toBe(20)
    expect(rows[7].amount).toBe(3)
  })
  it('is all zero without invoices', () => expect(notCoveredRows([]).every((r) => r.amount === 0)).toBe(true))
})

describe('topupGrid (TopupGrid)', () => {
  it('is shown only when a top-up amount was approved', () => {
    expect(topupGrid({ previousBalance: 1000, companyApproved: 100, topupPreviousBalance: 500, topupApproved: 0 })).toBeNull()
    expect(topupGrid({ previousBalance: 1000, companyApproved: 100, topupPreviousBalance: 500, topupApproved: null })).toBeNull()
  })
  it('shows balance, used and what is left for the main policy, the top-up policy and both', () => {
    const rows = topupGrid({ previousBalance: 1000, companyApproved: 100, topupPreviousBalance: 500, topupApproved: 50 })!
    expect(rows[0]).toEqual({ label: 'Bal Lmt', ghs4: '1,000.00', ghs5: '500.00', total: '1,500.00' })
    expect(rows[1]).toEqual({ label: 'Utilised', ghs4: '100.00', ghs5: '50.00', total: '150.00' })
    expect(rows[2]).toEqual({ label: 'Limit After This Claim', ghs4: '900.00', ghs5: '450.00', total: '1,350.00' })
  })
  it('shows a dash for an amount of zero', () => {
    const rows = topupGrid({ previousBalance: 0, companyApproved: 0, topupPreviousBalance: 500, topupApproved: 500 })!
    expect(rows[0].ghs4).toBe('-')
    expect(rows[2]).toMatchObject({ ghs5: '-', total: '-' })
  })
})

describe('collectedByText', () => {
  it('is Medix unless the payor or the hospital collects', () => {
    expect(collectedByText('P')).toBe('By Payor')
    expect(collectedByText(' H ')).toBe('By Hospital')
    expect(collectedByText('M')).toBe('By Medix')
    expect(collectedByText(null)).toBe('By Medix')
  })
})

describe('summaryRows', () => {
  const summary: EnquirySummary = {
    totalActual: 1000,
    totalApproved: 900,
    coPayRb: 10,
    totalExcess: -35,
    limitExceeded: 0,
    exGratia: 0,
    btbg: 0,
    processingFee: 5,
    majorMedicalFee: 0,
    mainTopup: 0,
    hospitalPayorToCollect: 0,
    payableToHospital: 865,
    payableToMember: 0,
    finalApprove: 900,
    bordxAmount: 870,
  }
  it("keeps the desktop's order and labels", () => {
    const rows = summaryRows(summary, { underwritingExcess: 20, excessCollectedBy: 'H', limitCollectedBy: 'P', nonPayment: true })
    expect(rows.map((r) => r.label).slice(0, 5)).toEqual(['Total Actual', 'Total Approved', 'Co-Payment R&B', 'Underwriting Excess', 'Total Excess'])
    expect(rows.find((r) => r.label === 'Excess Collected By')?.value).toBe('By Hospital')
    expect(rows.find((r) => r.label === 'Limit Collected By')?.value).toBe('By Payor')
    expect(rows.find((r) => r.label === 'Underwriting Excess')?.value).toBe('20.00')
    expect(rows.find((r) => r.label === 'Final Total - Payable to Hospital')?.value).toBe('865.00')
    expect(rows.find((r) => r.label === 'Bordereaux Amount')?.value).toBe('870.00')
    expect(rows.find((r) => r.label === 'Non-Payment')?.value).toBe('Yes')
  })
})

describe('showsBordxInd', () => {
  it('is for payors MH and IB only', () => {
    expect(showsBordxInd('IB')).toBe(true)
    expect(showsBordxInd(' mh ')).toBe(true)
    expect(showsBordxInd('AH')).toBe(false)
    expect(showsBordxInd(null)).toBe(false)
  })
})

describe('disabilityText', () => {
  const d = (source: string, slot: number, diagnosis: string, icdCode: string): EnquiryDiagnosis => ({ source, slot, diagnosis, onsetDate: null, icdCode })
  it('lists the final diagnoses one per line and their ICD codes with commas', () => {
    const text = disabilityText([d('First', 1, 'PRELIM', 'A00'), d('Final', 1, 'FISTULA', 'K60'), d('Final', 2, ' ', ' '), d('Final', 3, 'ABSCESS', 'K61')])
    expect(text).toEqual({ disability: 'FISTULA\nABSCESS', icdCodes: 'K60, K61' })
  })
  it('is empty without final diagnoses', () => expect(disabilityText([d('First', 1, 'x', 'y')])).toEqual({ disability: '', icdCodes: '' }))
})

describe('joined', () => {
  it('strings values together and leaves blanks out', () => {
    expect(joined(['A1', null, ' ', 'A2'])).toBe('A1, A2')
    expect(joined(['01/01/2021', '02/01/2021'], ',')).toBe('01/01/2021,02/01/2021')
  })
})

describe('worksheetExport (CmdExport_Click)', () => {
  const summary = Object.fromEntries(
    [
      'totalActual',
      'totalApproved',
      'coPayRb',
      'totalExcess',
      'limitExceeded',
      'exGratia',
      'btbg',
      'processingFee',
      'majorMedicalFee',
      'mainTopup',
      'hospitalPayorToCollect',
      'payableToHospital',
      'payableToMember',
      'finalApprove',
      'bordxAmount',
    ].map((k) => [k, 0]),
  )
  const result = {
    header: {
      caseNo: 'AB00000001',
      memberNo: 'ABHA0000001*01',
      memberName: 'A MEMBER',
      patientName: 'A PATIENT',
      hospital: 'A HOSPITAL',
      underwritingExcess: 0,
      excessCollectedBy: 'M',
      limitCollectedBy: 'P',
      nonPayment: false,
    },
    selectedVersion: '2',
    benefits: [
      {
        slot: 1,
        benefitCode: 'B1',
        category: null,
        benefit: 'Room & Board',
        days: '3',
        limit: 300,
        actual: 1234.5,
        approved: 900,
        hospital: 900,
        member: null,
      },
    ],
    totals: { actual: 1234.5, approved: 900, hospital: 900, member: 0 },
    summary: { ...summary, totalActual: 1234.5 },
  } as unknown as EnquiryResult

  it('gives the benefits with their total, then the summary, under the case and version', () => {
    const spec = worksheetExport(result)
    expect(spec.fileName).toBe('worksheet-AB00000001-2')
    expect(spec.title).toBe('Worksheet AB00000001 version 2')
    expect(spec.subtitle).toBe('A PATIENT / ABHA0000001*01 - A HOSPITAL')
    expect(spec.blocks.map((b) => b.heading)).toEqual(['Benefits', 'Summary'])
    const [benefits, totals] = blockRows(spec)
    expect(benefits.labels).toEqual(['Benefits', 'Days/Mths', 'Limit', 'Actual', 'Approved', 'Payable to Hosp', 'Due to/(frm) Mem'])
    expect(benefits.numeric).toEqual([false, false, true, true, true, true, true])
    expect(benefits.cells).toEqual([
      ['Room & Board', '3', '300.00', '1,234.50', '900.00', '900.00', ''],
      ['Total', '', '', '1,234.50', '900.00', '900.00', '0.00'],
    ])
    expect(totals.cells[0]).toEqual(['Total Actual', '1,234.50'])
    expect(totals.cells.at(-1)).toEqual(['Non-Payment', 'No'])
  })
})
