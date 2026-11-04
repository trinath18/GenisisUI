import { describe, expect, it } from 'vitest'
import {
  fileRows,
  newReceipts,
  paymentColumns,
  receiptColumns,
  reissueColumns,
  scanProblem,
  searchDefaults,
  searchParams,
  searchSchema,
} from './paymentEnquiryMemberRules'
import type { PaymentRow, ReceiptRow } from './paymentEnquiryMemberRules'

const row = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  crNo: 'DAC00054',
  caseNo: 'AC00000644',
  claimVersion: '2',
  payable: 13195.8,
  memberName: 'ANUSUIA A/P GUNASEKARAN',
  payTo: 'ANUSUIA',
  mbmNo: 'ACHA0232834*01',
  pvIndex: 355652,
  paidAmt: 100,
  arStatus: null,
  pvNo: 'VOID',
  pvDate: '2021-03-26T00:00:00',
  pvStatus: null,
  payStatus: 'F',
  chequeNo: 'VOID',
  chequeDate: '2021-03-26T00:00:00',
  chequeAmt: 100,
  pvPayTo: 'ANUSUIA',
  payeeBank: 'MBB',
  payeeAcNo: '123',
  remark: 'r',
  wsStatus: 'AA',
  sunPvNo: null,
  sunPvDate: null,
  bankCharges: 1.5,
  accMonth: '3',
  accYear: '2021',
  updatedBy: 'FARISHA',
  paidTotal: null,
  os: null,
  ...over,
})
const receipt = (over: Partial<ReceiptRow> = {}): ReceiptRow => ({
  caseNo: 'AC1',
  claimVersion: '1',
  mbmNo: 'M1',
  kind: 'PAY',
  payable: 10,
  amount: 91,
  receiptNo: 'RB1',
  receiptDate: '2021-03-11T00:00:00',
  accMonth: '3',
  accYear: '2021',
  remarks: 'x',
  ...over,
})

describe('Payment To Member enquiry', () => {
  it('has the columns of the three lists in the desktops order', () => {
    expect(paymentColumns.map((c) => c.label)).toEqual([
      'CR No',
      'Pymt Status',
      'Member Name',
      'Pay To',
      'Clm No',
      'Pay2MBM',
      'Amt Paid',
      'OS Amt',
      'AR Status',
      'PV No',
      'PV Status',
      'Cheque No',
      'Cheque Date',
      'Payee Bank',
      'Payee A/C No',
      'Remark',
      'WS Claimability',
      'SUN PV',
      'SUN PVDate',
    ])
    expect(receiptColumns.map((c) => c.label)).toEqual([
      'Clm No',
      'Member No',
      'Receipt From',
      'Pay2MBM',
      'Receipt Amt',
      'Receipt No',
      'Receipt Date',
      'A/C Period',
      'Remarks',
    ])
    expect(reissueColumns.map((c) => c.label)).toHaveLength(16)
  })

  it('shows a payment, a part-paid claim with the sum of its payments and what is left, and an unpaid claim with the whole amount outstanding', () => {
    expect(paymentColumns.map((c) => c.value(row()))).toEqual([
      'DAC00054',
      'Full',
      'ANUSUIA A/P GUNASEKARAN',
      'ANUSUIA',
      'AC00000644-2',
      '13,195.80',
      '100.00',
      '',
      '',
      'VOID',
      '',
      'VOID',
      '26/03/2021',
      'MBB',
      '123',
      'r',
      'AA',
      '',
      '',
    ])
    const partial = row({ payStatus: 'P', payable: 1000, paidAmt: 300, paidTotal: 700, os: 300 })
    expect([paymentColumns[1].value(partial), paymentColumns[6].value(partial), paymentColumns[7].value(partial)]).toEqual(['Partial', '700.00', '300.00'])
    const unpaid = row({ payStatus: null, paidAmt: null, pvIndex: null, os: 13195.8 })
    expect([paymentColumns[1].value(unpaid), paymentColumns[6].value(unpaid), paymentColumns[7].value(unpaid)]).toEqual(['Unpaid', '', '13,195.80'])
  })

  it('shows a receipt and a reissued payment', () => {
    expect(receiptColumns.map((c) => c.value(receipt()))).toEqual(['AC1-1', 'M1', 'PAY', '10.00', '91.00', 'RB1', '11/03/2021', '3/2021', 'x'])
    expect(reissueColumns.map((c) => c.value(row({ pvStatus: 'R' })))).toEqual([
      'ANUSUIA A/P GUNASEKARAN',
      'AC00000644-2',
      '100.00',
      '355652',
      'VOID',
      '26/03/2021',
      'VOID',
      '26/03/2021',
      '100.00',
      'ANUSUIA',
      'MBB',
      '123',
      '1.50',
      '3/2021',
      'FARISHA',
      'r',
    ])
  })

  it('does not add the receipts of a claim that is in the list already', () => {
    const have = [receipt({ caseNo: 'AC1' })]
    expect(newReceipts(have, [receipt({ caseNo: 'ac1' }), receipt({ caseNo: 'AC2' })]).map((r) => r.caseNo)).toEqual(['AC2'])
  })

  it('asks for the case number in Use Scan and does not add a claim twice', () => {
    expect(scanProblem(searchDefaults, [])).toBe('Please Enter Worksheet No')
    expect(scanProblem({ ...searchDefaults, caseNo: 'ac00000644' }, [row()])).toBe('Data has been uploaded!')
    expect(scanProblem({ ...searchDefaults, caseNo: 'AC00000645' }, [row()])).toBeNull()
    expect(scanProblem({ ...searchDefaults, scan: false }, [])).toBeNull()
  })

  it('sends the codes of the boxes, ISO dates and numbers', () => {
    expect(
      searchParams({
        ...searchDefaults,
        caseNo: ' AC1 ',
        payor: 'AC - ALLIANZ',
        healthType: 'N - Non-Sihat',
        wsStatus: 'AA - Accepted',
        payment: '3',
        pvDateFrom: '26/03/2021',
        monthFrom: '3',
        yearTo: '2021',
        blankCrNo: true,
      }),
    ).toMatchObject({
      caseNo: 'AC1',
      payor: 'AC',
      healthType: 'N',
      wsStatus: 'AA',
      payment: 3,
      pvDateFrom: '2021-03-26',
      monthFrom: 3,
      yearTo: 2021,
      blankCrNo: true,
      mbmName: undefined,
    })
    expect(fileRows([row()])[0]).toHaveLength(19)
  })

  it('checks the box lengths and the dates', async () => {
    await expect(searchSchema.validate({ ...searchDefaults, caseNo: 'x'.repeat(31) })).rejects.toThrow('Case No is too long.')
    await expect(searchSchema.validate({ ...searchDefaults, pvDateFrom: '31/02/2021' })).rejects.toThrow('Invalid Date Format!')
    await expect(searchSchema.validate(searchDefaults)).resolves.toBeTruthy()
  })
})
