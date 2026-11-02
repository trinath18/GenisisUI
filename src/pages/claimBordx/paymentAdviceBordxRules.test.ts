import { describe, expect, it } from 'vitest'
import {
  bordxProblem,
  bordxRequest,
  cashTypeOptions,
  groupCompanyProblem,
  payColumns,
  payDefaults,
  payParams,
  tickProblem,
  totalApproved,
} from './paymentAdviceBordxRules'
import type { PayRow } from './paymentAdviceBordxRules'

const row = (over: Partial<PayRow> = {}): PayRow =>
  ({
    payor: 'MH',
    caseNo: 'MH1',
    claimVersion: 2,
    appAmt: 100.5,
    doa: '2026-09-29T00:00:00',
    dod: '2026-10-01T00:00:00',
    cashType: 'H',
    patient: 'A PATIENT',
    hospital: 'H1',
    hosAmt: 90,
    groupCompany: 'ACME',
    planCode: 'P1',
    icdCode: 'A09',
    btbg: '',
    insuredType: 'I',
    claimability: 'Y',
    costCenter: 'CC',
    groupCategory: 'GC',
    hospitalState: 'SEL',
    wksNo: 'MH1-2',
    ...over,
  }) as PayRow

describe('Payment Advice bordx criteria', () => {
  it('opens in scan mode and offers hospital and member cash types', () => {
    expect(payDefaults.useScan).toBe(true)
    expect(cashTypeOptions.map((o) => o.label)).toEqual(['H - Hospital', 'M - Member'])
  })

  it('sends the scan or range query and drops a date whose empty box is ticked', () => {
    expect(payParams({ ...payDefaults, wksNoFrom: ' MH1 ', version: '2', wksNoTo: 'MH9', cashType: 'H', hospital: ' H1 ', doaFrom: '01/09/2026' })).toEqual({
      useScan: true,
      wksNoFrom: 'MH1',
      wksNoTo: undefined,
      version: 2,
      cashType: 'H',
      hospital: 'H1',
      doaFrom: '2026-09-01',
      doaTo: undefined,
      doaEmpty: false,
      dodFrom: undefined,
      dodTo: undefined,
      dodEmpty: false,
    })
    const range = payParams({ ...payDefaults, useScan: false, wksNoFrom: 'MH1', wksNoTo: 'MH9', version: '2', doaFrom: '01/09/2026', doaEmpty: true })
    expect([range.wksNoTo, range.version, range.doaFrom, range.doaEmpty]).toEqual(['MH9', undefined, undefined, true])
  })
})

describe('Payment Advice bordx rules', () => {
  it('applies the tick rules in the desktop order', () => {
    expect(tickProblem(row({ dod: null }))).toBe('Date of Discharge is Empty.')
    expect(tickProblem(row({ hospital: ' ' }))).toBe('Hospital cannot be empty!')
    expect(tickProblem(row({ icdCode: null }))).toBe('Final ICD Code cannot be empty!')
    expect(tickProblem(row({ claimability: 'N' }))).toBe('Claimability is Not Decided!')
    expect(tickProblem(row({ costCenter: '' }))).toBe('Cost Centre is empty')
    expect(tickProblem(row({ groupCategory: null }))).toBe('Group Category is empty')
    expect(tickProblem(row())).toBeNull()
    expect(groupCompanyProblem(row({ insuredType: 'G', groupCompany: '' }))).toBe('Group Company cannot be empty!')
    expect(groupCompanyProblem(row({ insuredType: 'H' }))).toBeNull()
    expect(groupCompanyProblem(row({ insuredType: 'I', groupCompany: '' }))).toBeNull()
  })

  it('checks the list and the ticks before generating, sends the ticked worksheets and totals the amounts', () => {
    expect(bordxProblem(0, 0)).toBe('Please select a record before proceeding!')
    expect(bordxProblem(3, 0)).toBe('Please select at least one record to be updated! ')
    expect(bordxProblem(3, 1)).toBeNull()
    expect(bordxRequest([row(), row({ caseNo: 'MH2', claimVersion: 1 })])).toEqual({
      items: [
        { caseNo: 'MH1', claimVersion: 2 },
        { caseNo: 'MH2', claimVersion: 1 },
      ],
    })
    expect(totalApproved([row(), row({ appAmt: null }), row({ appAmt: 4 })])).toBe(104.5)
  })

  it('lists the columns as the desktop did and shows an empty BTBG as N', () => {
    expect(payColumns.map((c) => c.label)).toEqual([
      'Payor',
      'Case No',
      'Claim Version',
      'Wks No',
      'Cash Type',
      'Hos Amt',
      'App Amt',
      'DOA',
      'DOD',
      'Patient',
      'Hospital',
      'Grp Company',
      'Plan Code',
      'ICD Code',
      'BTBG',
      'Insured Type',
      'Claimability',
      'Cost Centre',
      'Group Category',
      'Hosp State',
    ])
    expect(payColumns.map((c) => c.value(row()))).toEqual([
      'MH',
      'MH1',
      '2',
      'MH1-2',
      'H',
      '90.00',
      '100.50',
      '29/09/2026',
      '01/10/2026',
      'A PATIENT',
      'H1',
      'ACME',
      'P1',
      'A09',
      'N',
      'I',
      'Y',
      'CC',
      'GC',
      'SEL',
    ])
  })
})
