import { describe, expect, it } from 'vitest'
import {
  amountOptions,
  rowKey,
  searchDefaults,
  searchParams,
  tickProblem,
  totalApproved,
  updateColumns,
  updateDefaults,
  updateProblem,
  updateRequest,
  yearOptions,
} from './updateBordxRules'
import type { UpdateRow, UpdateValues } from './updateBordxRules'

const row = (over: Partial<UpdateRow> = {}): UpdateRow =>
  ({
    payorCode: 'TA',
    caseNo: 'TA00001',
    claimVersion: 2,
    totalActual: 1200,
    totalApproved: 1000.5,
    payableToHospital: 900,
    payableToMember: 100.5,
    dateAdmitted: '2021-05-01T00:00:00',
    dateDischarged: '2021-05-03T00:00:00',
    patientName: 'A PATIENT',
    hospital: 'A HOSPITAL',
    groupCompany: 'ACME',
    planCode: 'PL1',
    icdCode: 'A09',
    claimStatus: 'R',
    bordxNo: null,
    ...over,
  }) as UpdateRow
const v = (over: Partial<UpdateValues>): UpdateValues => ({ ...updateDefaults, ...over })

describe('Update Bordx search', () => {
  it('starts on the worksheets that are in no bordx and sends dates as ISO days', () => {
    expect(searchDefaults.unbordxedOnly).toBe(true)
    expect(amountOptions.map((o) => o.label)).toEqual(['<= 2000', '> 2000'])
    expect(searchParams({ ...searchDefaults, payor: ' TA - x ', amount: 'le', doaFrom: '01/05/2021', caseFrom: ' TA1 ', bordxTo: ' B9 ' })).toEqual({
      payor: 'TA - x',
      amount: 'le',
      unbordxedOnly: true,
      doaFrom: '2021-05-01',
      doaTo: undefined,
      dodFrom: undefined,
      dodTo: undefined,
      caseFrom: 'TA1',
      caseTo: undefined,
      bordxFrom: undefined,
      bordxTo: 'B9',
    })
  })

  it('refuses a worksheet that is in a bordx already and totals the approved amounts', () => {
    expect(tickProblem(row({ bordxNo: 'B1' }))).toBe('Claim has been bordxed!')
    expect(tickProblem(row())).toBeNull()
    expect(rowKey(row())).toBe('TA00001-2')
    expect(totalApproved([row(), row({ totalApproved: null }), row({ totalApproved: 4 })])).toBe(1004.5)
  })

  it('lists the columns as the desktop did, with the bordx number', () => {
    expect(updateColumns.map((c) => c.label)).toEqual([
      'Payor',
      'Case No',
      'Claim Version',
      'Wks No',
      'Actual Amt',
      'App Amt',
      'Hosp Amt',
      'Member Amt',
      'DOA',
      'DOD',
      'Patient',
      'Hospital',
      'Grp Company',
      'Plan Code',
      'ICD Code',
      'Bordx No',
    ])
    expect(updateColumns.map((c) => c.value(row()))).toEqual([
      'TA',
      'TA00001',
      '2',
      'TA00001-2',
      '1,200.00',
      '1,000.50',
      '900.00',
      '100.50',
      '01/05/2021',
      '03/05/2021',
      'A PATIENT',
      'A HOSPITAL',
      'ACME',
      'PL1',
      'A09',
      '',
    ])
    expect(yearOptions(new Date(2026, 9, 30)).map((o) => o.value)).toEqual(['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028'])
  })
})

describe('Update Bordx checks', () => {
  it('checks the list, the ticks, the bordx number and the date, in the desktop order', () => {
    expect(updateProblem(0, 0, v({}))?.message).toBe('Please select a record before proceeding!')
    expect(updateProblem(3, 0, v({}))?.message).toBe('Please select at least one record to be updated! ')
    expect(updateProblem(3, 1, v({}))).toEqual({ field: 'bordxNo', message: 'Please Enter Bordx No! ' })
    expect(updateProblem(3, 1, v({ bordxNo: 'B1' }))).toEqual({ field: 'bordxDate', message: 'Please Enter Bordx Date! ' })
    expect(updateProblem(3, 1, v({ bordxNo: 'B1', bordxDate: '30/10/2026' }))).toBeNull()
  })

  it('needs the receipt number when any other receipt box is filled', () => {
    expect(updateProblem(3, 1, v({ bordxNo: 'B1', bordxDate: '30/10/2026', chequeAmount: '5' }))?.message).toBe('Please Enter Receipt No!')
    expect(updateProblem(3, 1, v({ bordxNo: 'B1', bordxDate: '30/10/2026', receiptNo: 'R1', chequeAmount: '5' }))).toBeNull()
  })

  it('sends the ticked worksheets, the bordx, the dates and the receipt', () => {
    expect(
      updateRequest(
        [row(), row({ caseNo: 'TA00002', claimVersion: 1 })],
        v({ bordxNo: ' B1 ', bordxDate: '30/10/2026', acMonth: '7', toPayorDate: '31/10/2026', receiptNo: ' r1 ', chequeAmount: '1,250.50', chequeNo: 'C1' }),
      ),
    ).toEqual({
      claims: [
        { caseNo: 'TA00001', version: 2 },
        { caseNo: 'TA00002', version: 1 },
      ],
      bordxNo: 'B1',
      bordxDate: '2026-10-30',
      acMonth: '7',
      acYear: undefined,
      toPayorDate: '2026-10-31',
      fromPayorDate: undefined,
      toMnrbDate: undefined,
      fromMnrbDate: undefined,
      receiptNo: 'r1',
      receiptDate: undefined,
      chequeAmount: 1250.5,
      chequeNo: 'C1',
    })
  })
})
