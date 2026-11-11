import { describe, expect, it } from 'vitest'
import { hospitalEnabled, invoiceLabel, originalDefaults, showProblem, updateProblem, updateRequest, valuesOf } from './invoiceOriginalRules'
import type { OriginalInvoice, OriginalValues } from './invoiceOriginalRules'

const invoice = (over: Partial<OriginalInvoice> = {}): OriginalInvoice => ({
  id: 7,
  caseNo: 'XI00002412',
  version: '2',
  invoiceNo: 'CN-2100001755',
  invoiceDate: '2020-12-07T00:00:00',
  originalReceivedDate: '2021-08-06T00:00:00',
  originalStatus: 'Y',
  payTo: 'H',
  hospitalCode: 'ASSUN',
  hospitalAccCode: '83A005',
  hospitalName: 'ASSUNTA HOSPITAL',
  ...over,
})

const values = (over: Partial<OriginalValues> = {}): OriginalValues => ({
  ...originalDefaults,
  caseNo: 'XI00002412',
  version: '2',
  invoiceNo: 'INV-1',
  originalDate: '06/08/2021',
  ...over,
})

describe('showProblem', () => {
  it('needs a case and then a version, with the desktop messages', () => {
    expect(showProblem(originalDefaults)).toEqual({ field: 'caseNo', message: 'Please Enter Case No' })
    expect(showProblem({ ...originalDefaults, caseNo: 'AB1' })).toEqual({ field: 'version', message: 'Please Enter Case Version' })
    expect(showProblem({ ...originalDefaults, caseNo: 'AB1', version: '1' })).toBeNull()
    expect(showProblem({ ...originalDefaults, caseNo: '  ', version: '1' })?.field).toBe('caseNo')
  })
})

describe('updateProblem', () => {
  it('checks the case, the invoice number and the OIR date in that order', () => {
    expect(updateProblem(values({ caseNo: '' }))).toEqual({ field: 'caseNo', message: 'Please Enter Case No!' })
    expect(updateProblem(values({ invoiceNo: '  ' }))).toEqual({ field: 'invoiceNo', message: 'Please Enter Invoice No!' })
    expect(updateProblem(values({ originalDate: '' }))).toEqual({ field: 'originalDate', message: 'Please Enter Invoice Date!' })
    expect(updateProblem(values({ originalDate: '31/02/2021' }))?.field).toBe('originalDate')
    expect(updateProblem(values())).toBeNull()
  })

  it('does not need the invoice date', () => expect(updateProblem(values({ invoiceDate: '' }))).toBeNull())
})

describe('valuesOf and updateRequest', () => {
  it('shows dates as dd/mm/yyyy and the hospital by code', () => {
    expect(valuesOf(invoice())).toEqual({
      caseNo: 'XI00002412',
      version: '2',
      invoiceNo: 'CN-2100001755',
      originalDate: '06/08/2021',
      invoiceDate: '07/12/2020',
      hospital: 'ASSUN',
    })
    expect(valuesOf(invoice({ invoiceNo: null, invoiceDate: null, originalReceivedDate: null, hospitalCode: null }))).toMatchObject({
      invoiceNo: '',
      invoiceDate: '',
      originalDate: '',
      hospital: '',
    })
  })

  it('sends ISO dates, trims the number and leaves an empty invoice date and hospital as null', () => {
    expect(updateRequest(values({ invoiceNo: ' INV-1 ', invoiceDate: '01/08/2021', hospital: 'KBARU' }))).toEqual({
      invoiceNo: 'INV-1',
      invoiceDate: '2021-08-01',
      originalReceivedDate: '2021-08-06',
      hospitalCode: 'KBARU',
    })
    expect(updateRequest(values())).toMatchObject({ invoiceDate: null, hospitalCode: null })
  })
})

describe('hospitalEnabled and invoiceLabel', () => {
  it('enables the hospital only for an invoice paid to a known hospital', () => {
    expect(hospitalEnabled(invoice())).toBe(true)
    expect(hospitalEnabled(invoice({ hospitalName: null }))).toBe(false)
    expect(hospitalEnabled(undefined)).toBe(false)
  })

  it('labels the invoices of a version by position, number and date', () => {
    expect(invoiceLabel(invoice(), 1)).toBe('1. CN-2100001755 · 07/12/2020')
    expect(invoiceLabel(invoice({ invoiceNo: null, invoiceDate: null }), 2)).toBe('2. (no number)')
  })
})
