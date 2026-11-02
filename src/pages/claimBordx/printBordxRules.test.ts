import { describe, expect, it } from 'vitest'
import {
  btbgOptions,
  detailRows,
  printColumns,
  printDefaults,
  printOptionOptions,
  printRequest,
  reportTypeOptions,
  searchParams,
  searchProblem,
  summaryRows,
} from './printBordxRules'
import type { PrintDocument, PrintRow, PrintValues } from './printBordxRules'

const v = (over: Partial<PrintValues> = {}): PrintValues => ({ ...printDefaults, ...over })
const row = (over: Partial<PrintRow> = {}): PrintRow =>
  ({
    planCode: 'AZ93',
    insCode: 'H',
    caseNo: 'UT1',
    claimVersion: 3,
    patientName: 'A PATIENT',
    memberNo: 'UT1*03',
    hospital: 'A HOSPITAL',
    payableToHospital: 213.3,
    totalActual: 220,
    totalApproved: 213.3,
    payableToMember: 0,
    debitCreditRefNo: null,
    bordxNo: 'NUT1',
    printed: false,
    healthType: 'N',
    payorCode: 'UT',
    btbg: 'N',
    payTo: 'H',
    caseMgmtFees: 0,
    totalMgmtFee: 5,
    bordxDate: '2021-06-08T00:00:00',
    bordxAmount: 213.3,
    ...over,
  }) as PrintRow

const doc: PrintDocument = {
  kind: 'detail',
  reportType: 'single',
  btbg: 'N',
  printedDate: '2026-10-30T00:00:00',
  bordxFrom: 'NUT1',
  bordxTo: 'NUT2',
  payor: { code: 'UT', name: 'UNITAR', address1: 'A1', address2: 'A2', address3: 'A3', product: 'GROUP H&S' },
  rows: [
    {
      bordxNo: 'NUT1',
      bordxDate: '2021-06-08T00:00:00',
      caseNo: 'UT1',
      claimVersion: 3,
      patientName: 'A PATIENT',
      memberNo: 'UT1*03',
      policyNo: 'P1',
      patientIc: 'IC1',
      hospital: 'H1',
      planCode: 'AZ93',
      dateAdmitted: '2021-03-29T00:00:00',
      dateDischarged: '2021-03-30T00:00:00',
      icdCode1: 'A09',
      icdDesc1: 'DIARRHOEA',
      icdCode2: 'B01',
      icdDesc2: null,
      totalActual: 220,
      totalApproved: 213.3,
      payableToHospital: 213.3,
      payableToMember: 0,
      totalMgmtFee: 5,
      bordxAmount: 213.3,
      debitCreditRefNo: 'D1',
      remarks: 'R',
    },
    {
      bordxNo: 'NUT2',
      bordxDate: '2021-07-05T00:00:00',
      caseNo: 'UT2',
      claimVersion: 1,
      patientName: 'B PATIENT',
      memberNo: 'UT2*01',
      policyNo: null,
      patientIc: null,
      hospital: null,
      planCode: null,
      dateAdmitted: null,
      dateDischarged: null,
      icdCode1: null,
      icdDesc1: null,
      icdCode2: null,
      icdDesc2: null,
      totalActual: 10,
      totalApproved: 8,
      payableToHospital: 8,
      payableToMember: 0,
      totalMgmtFee: 1,
      bordxAmount: 8,
      debitCreditRefNo: null,
      remarks: null,
    },
  ] as PrintDocument['rows'],
  summary: [
    {
      bordxNo: 'NUT1',
      bordxDate: '2021-06-08T00:00:00',
      claims: 1,
      totalActual: 220,
      totalApproved: 213.3,
      payableToHospital: 213.3,
      payableToMember: 0,
      mgmtFee: 5,
      bordxAmount: 213.3,
    },
    {
      bordxNo: 'NUT2',
      bordxDate: '2021-07-05T00:00:00',
      claims: 1,
      totalActual: 10,
      totalApproved: 8,
      payableToHospital: 8,
      payableToMember: 0,
      mgmtFee: 1,
      bordxAmount: 8,
    },
  ],
  marked: false,
}

describe('Print Bordx criteria', () => {
  it('opens on a single-claim report, BTBG N and Print New', () => {
    expect(printDefaults).toEqual({ bordxFrom: '', bordxTo: '', reportType: 'single', btbg: 'N', printOption: 'new' })
    expect(reportTypeOptions.map((o) => o.label)).toEqual(['Single Claim', 'Multiple Claims'])
    expect(btbgOptions.map((o) => o.value)).toEqual(['N', 'Y'])
    expect(printOptionOptions.map((o) => o.label)).toEqual(['Print New', 'Reprint'])
  })

  it('needs both ends of the bordx range', () => {
    expect(searchProblem(v())).toEqual({ field: 'bordxFrom', message: 'Please enter Bordx Reference No' })
    expect(searchProblem(v({ bordxFrom: 'B1' }))).toEqual({ field: 'bordxTo', message: 'Please enter Bordx Reference No' })
    expect(searchProblem(v({ bordxFrom: 'B1', bordxTo: 'B2' }))).toBeNull()
    expect(searchParams(v({ bordxFrom: ' B1 ', bordxTo: ' B2 ' }))).toEqual({ bordxFrom: 'B1', bordxTo: 'B2' })
  })

  it('sends the range, the choices and whether it is printed', () => {
    expect(printRequest(v({ bordxFrom: 'B1', bordxTo: 'B2', btbg: 'Y', printOption: 'reprint' }), 'detail', true)).toEqual({
      bordxFrom: 'B1',
      bordxTo: 'B2',
      kind: 'detail',
      reportType: 'single',
      btbg: 'Y',
      printOption: 'reprint',
      print: true,
    })
    expect(printRequest(v({ bordxFrom: 'B1', bordxTo: 'B2' }), 'summary', false).print).toBe(false)
  })
})

describe('Print Bordx files', () => {
  it('lists the columns as the desktop did and shows BTBG and the print status', () => {
    expect(printColumns.map((c) => c.label)).toEqual([
      'Plan Code',
      'Claim No',
      'Patient Name',
      'Member No',
      'Hospital',
      'Bordx Amt',
      'Bill Amt',
      'Approve Amt',
      'Recovery Amt',
      'Case Mgmt Fee',
      'Debit Credit Ref No',
      'Bordx No',
      'Print Status',
      'HLT Code',
      'Payor',
      'BTBG',
    ])
    expect(printColumns.map((c) => c.value(row()))).toEqual([
      'AZ93',
      'UT1-3',
      'A PATIENT',
      'UT1*03',
      'A HOSPITAL',
      '213.30',
      '220.00',
      '213.30',
      '0.00',
      '0.00',
      '',
      'NUT1',
      'NO',
      'N',
      'UT',
      'N',
    ])
    expect(printColumns[12].value(row({ printed: true }))).toBe('YES')
    expect(printColumns[15].value(row({ btbg: 'Y' }))).toBe('Y')
  })

  it('writes the detail report with the payor on top and the totals at the bottom', () => {
    const rows = detailRows(doc)
    expect(rows.slice(0, 7)).toEqual([
      ['Claim Bordx - Detail'],
      ['Payor', 'UT - UNITAR'],
      ['A1'],
      ['A2'],
      ['A3'],
      ['Product', 'GROUP H&S'],
      ['Bordx', 'NUT1 to NUT2', 'BTBG', 'N', 'Report', 'Single Claim', 'Date', '30/10/2026'],
    ])
    expect(rows[9]).toEqual([
      'NUT1',
      '08/06/2021',
      'UT1-3',
      'A PATIENT',
      'IC1',
      'UT1*03',
      'P1',
      '',
      '',
      'H1',
      'AZ93',
      '29/03/2021',
      '30/03/2021',
      'A09; B01',
      'DIARRHOEA',
      '220.00',
      '213.30',
      '213.30',
      '0.00',
      '5.00',
      '213.30',
      'D1',
      'R',
    ])
    expect(rows.at(-1)!.slice(0, 3)).toEqual(['Total', '', '2'])
    expect(rows.at(-1)!.slice(15)).toEqual(['230.00', '221.30', '221.30', '0.00', '6.00', '221.30'])
  })

  it('writes the summary report by bordx', () => {
    const rows = summaryRows({ ...doc, kind: 'summary', reportType: 'multiple' })
    expect(rows[6][5]).toBe('Multiple Claims')
    expect(rows[8]).toEqual(['Bordx No', 'Bordx Date', 'Claims', 'Actual Amt', 'Approved Amt', 'Hosp Amt', 'Member Amt', 'Mgmt Fee', 'Bordx Amt'])
    expect(rows[9]).toEqual(['NUT1', '08/06/2021', '1', '220.00', '213.30', '213.30', '0.00', '5.00', '213.30'])
    expect(rows.at(-1)).toEqual(['Total', '', '2', '230.00', '221.30', '221.30', '0.00', '6.00', '221.30'])
  })
})
