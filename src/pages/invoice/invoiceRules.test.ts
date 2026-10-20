import { describe, expect, it } from 'vitest'
import { amountNote, invoicesTotal, payToText, unregistered, worksheetText } from './invoiceRules'
import type { InvoiceSummary } from './invoiceRules'

const invoice = (over: Partial<InvoiceSummary>): InvoiceSummary => ({
  index: 1,
  invoiceNo: 'I1',
  invoiceDate: null,
  payTo: 'H',
  payee: null,
  payeeName: null,
  amount: 100,
  inWorksheet: false,
  worksheetVersion: null,
  bordxNo: null,
  stayType: null,
  payType: null,
  receiptMode: null,
  receiptDate: null,
  followUpDate: null,
  roomType: null,
  excessAmount: null,
  payAmount: null,
  initialAmount: null,
  uhcNo: null,
  enteredBy: null,
  enteredDate: null,
  ...over,
})

describe('payToText', () => {
  it.each([
    ['H', 'Hospital'],
    ['h ', 'Hospital'],
    ['M', 'Member'],
    ['X', 'X'],
    [null, ''],
  ])('%s is %s', (code, text) => expect(payToText(code)).toBe(text))
})

describe('worksheetText', () => {
  it('says No for an invoice no worksheet has used', () => expect(worksheetText({ inWorksheet: false, worksheetVersion: '3' })).toBe('No'))
  it('names the version of a used invoice', () => expect(worksheetText({ inWorksheet: true, worksheetVersion: ' 2 ' })).toBe('Yes (version 2)'))
  it('copes with no version', () => expect(worksheetText({ inWorksheet: true, worksheetVersion: null })).toBe('Yes'))
})

describe('amountNote', () => {
  const detail = (rowsTotal: number, amount: number, match: boolean) => ({ rowsTotal, rowsMatchAmount: match, invoice: invoice({ amount }) })
  it('is empty when the rows add up', () => expect(amountNote(detail(100, 100, true))).toBe(''))
  it('says by how much they differ in numbers', () =>
    expect(amountNote(detail(1234.5, 1200, false))).toContain('1,234.50 but the invoice amount saved is 1,200.00'))
})

describe('invoice lists', () => {
  const list = [
    invoice({ index: 1, inWorksheet: true, amount: 10.1 }),
    invoice({ index: 2, inWorksheet: false, amount: 20.2 }),
    invoice({ index: 3, inWorksheet: false, amount: null }),
  ]
  it('lists the invoices not in a worksheet yet', () => expect(unregistered(list).map((i) => i.index)).toEqual([2, 3]))
  it('adds the amounts to the cent', () => expect(invoicesTotal(list)).toBe(30.3))
})
