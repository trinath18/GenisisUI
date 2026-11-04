import { describe, expect, it } from 'vitest'
import {
  codeOptions,
  fileRows,
  healthTypeOptions,
  paymentColumns,
  paymentOptions,
  scanProblem,
  searchDefaults,
  searchParams,
  searchSchema,
  totalPayable,
  wsStatusOptions,
} from './paymentEnquiryHospitalRules'
import type { PaymentRow } from './paymentEnquiryHospitalRules'

const row = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  payStatus: 'F',
  hospitalName: 'COLUMBIA ASIA',
  invNo: 'OPC-1',
  invDate: '2020-12-30T00:00:00',
  payable: 603.77,
  paidAmt: 603.77,
  patientName: 'LIAW SIN SIAN',
  caseNo: 'ST00072278',
  claimVersion: '8',
  bordxNo: 'NST0156166',
  arStatus: null,
  doa: '2020-12-16T00:00:00',
  dod: '2020-12-19T00:00:00',
  paymentDate: '2021-03-29T00:00:00',
  entryBy: 'FASEHAH',
  pvIndex: 972456,
  pvNo: 'CB00107747',
  chequeNo: '29032021',
  chequeDate: '2021-03-29T00:00:00',
  accMonth: 3,
  accYear: 2021,
  bankCharges: 1.5,
  wsStatus: 'AA',
  sunPvNo: null,
  sunPvDate: null,
  paidTotal: null,
  os: null,
  receiptNo: 'R1, M1',
  receiptAmt: 100,
  ...over,
})

describe('Payment To Hospital enquiry', () => {
  it('has the 26 columns of the desktop list in order', () => {
    expect(paymentColumns.map((c) => c.label)).toEqual([
      'Pymt Status',
      'Hosp Code',
      'Inv No',
      'INV Date',
      'Pay2HOS',
      'Amt Paid',
      'OS Amt',
      'Patient Name',
      'Clm No',
      'Bordx No',
      'AR Status',
      'DOA',
      'DOD',
      'DOP (Payment)',
      'Entry By',
      'PV HOS Index',
      'PV No',
      'Cheque No',
      'Cheque Date',
      'A/C Period',
      'Bank Charges',
      'Receipt No',
      'Receipt Amt',
      'WS Claimability',
      'SUN PV',
      'SUN PVDate',
    ])
    expect(paymentColumns.map((c) => c.value(row()))).toEqual([
      'Full',
      'COLUMBIA ASIA',
      'OPC-1',
      '30/12/2020',
      '603.77',
      '603.77',
      '',
      'LIAW SIN SIAN',
      'ST00072278-8',
      'NST0156166',
      '',
      '16/12/2020',
      '19/12/2020',
      '29/03/2021',
      'FASEHAH',
      '972456',
      'CB00107747',
      '29032021',
      '29/03/2021',
      '3/2021',
      '1.50',
      'R1, M1',
      '100.00',
      'AA',
      '',
      '',
    ])
  })

  it('shows a part-paid claim with the sum of its payments and what is left, and an unpaid one with the whole amount outstanding', () => {
    const partial = row({ payStatus: 'P', payable: 1000, paidAmt: 300, paidTotal: 700, os: 300 })
    expect([paymentColumns[0].value(partial), paymentColumns[5].value(partial), paymentColumns[6].value(partial)]).toEqual(['Partial', '700.00', '300.00'])
    const unpaid = row({ payStatus: null, paidAmt: null, os: 603.77, pvIndex: null })
    expect([paymentColumns[0].value(unpaid), paymentColumns[5].value(unpaid), paymentColumns[6].value(unpaid), paymentColumns[15].value(unpaid)]).toEqual([
      'Unpaid',
      '',
      '603.77',
      '',
    ])
  })

  it('adds the payable amounts and writes the list with its headings', () => {
    expect(totalPayable([row(), row({ payable: null }), row({ payable: -3 })])).toBeCloseTo(600.77)
    expect(fileRows([row()])).toHaveLength(2)
    expect(fileRows([row()])[0]).toHaveLength(26)
  })

  it('searches a scanned claim exactly or a claim range, with the codes of the boxes', () => {
    expect(
      searchParams({
        ...searchDefaults,
        caseFrom: ' ST1 ',
        hospital: 'KPMCP - KPJ',
        payor: 'AC - ALLIANZ',
        healthType: 'N - Non-Sihat',
        wsStatus: 'AA - Accepted',
        payment: '3',
        pvDateFrom: '29/03/2021',
      }),
    ).toMatchObject({
      scanCase: 'ST1',
      caseFrom: undefined,
      hospital: 'KPMCP',
      payor: 'AC',
      healthType: 'N',
      wsStatus: 'AA',
      payment: 3,
      pvDateFrom: '2021-03-29',
    })
    expect(searchParams({ ...searchDefaults, scan: false, caseFrom: 'A', caseTo: 'B' })).toMatchObject({ scanCase: undefined, caseFrom: 'A', caseTo: 'B' })
  })

  it('asks for the claim number in Use Scan and does not add a claim twice', () => {
    expect(scanProblem(searchDefaults, [])).toBe('Please Enter Worksheet No')
    expect(scanProblem({ ...searchDefaults, caseFrom: 'st00072278' }, [row()])).toBe('Data has been uploaded!')
    expect(scanProblem({ ...searchDefaults, caseFrom: 'ST00072279' }, [row()])).toBeNull()
    expect(scanProblem({ ...searchDefaults, scan: false }, [])).toBeNull()
  })

  it('offers the drop-downs the desktop had', () => {
    expect(paymentOptions.map((o) => o.label)).toEqual([
      '0 - All',
      '1 - Paid',
      '2 - Unpaid',
      '3 - Partial Paid',
      '4 - Paid & Partial Paid',
      '5 - Unpaid & Partial Paid',
    ])
    expect(wsStatusOptions).toHaveLength(13)
    expect(codeOptions([{ code: 'AC', name: 'ALLIANZ' }])[0].value).toBe('AC - ALLIANZ')
    expect(healthTypeOptions([{ code: 'N', description: 'Non-Sihat' }])[0].label).toBe('N - Non-Sihat')
  })

  it('checks the box lengths and the dates', async () => {
    await expect(searchSchema.validate({ ...searchDefaults, invNo: 'x'.repeat(101) })).rejects.toThrow('Inv No is too long.')
    await expect(searchSchema.validate({ ...searchDefaults, invDateFrom: '31/02/2021' })).rejects.toThrow('Invalid Date Format!')
    await expect(searchSchema.validate(searchDefaults)).resolves.toBeTruthy()
  })
})
