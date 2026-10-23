import { describe, expect, it } from 'vitest'
import { overpaymentWarning, receiptDefaults, receiptProblem } from './receiptRules'
import type { OutstandingInvoice } from './types'

const invoice = (over: Partial<OutstandingInvoice> = {}): OutstandingInvoice => ({
  invoiceNo: 'S34041',
  invoiceDate: '2021-07-01T00:00:00',
  members: 33,
  billAmount: 495,
  payor: 'CT',
  receipts: 1,
  received: 285.28,
  outstanding: 209.72,
  ...over,
})

describe('receiptDefaults', () => {
  it('offers the balance, a transfer, the payor and the invoice number', () => {
    expect(receiptDefaults(invoice(), '10/08/2021')).toEqual({
      receiptType: 'IPFEE',
      receiptDate: '10/08/2021',
      amount: '209.72',
      chequeNo: 'ONLINE',
      payor: 'CT',
      description: 'S34041',
    })
  })

  it('leaves the amount empty when nothing is outstanding', () => expect(receiptDefaults(invoice({ outstanding: -3 }), '').amount).toBe(''))
})

describe('receiptProblem (CmdSave_Click)', () => {
  const ok = { manual: false, receiptNo: '', invoiceNo: 'S1', receiptType: 'IPFEE', receiptDate: '10/08/2021', amount: '5' }
  it('accepts a complete receipt', () => expect(receiptProblem(ok)).toBeNull())
  it('asks the manual form for the receipt number first', () => expect(receiptProblem({ ...ok, manual: true, invoiceNo: '' })).toBe('Please Enter Receipt No'))
  it('checks in the desktop order', () => {
    expect(receiptProblem({ ...ok, invoiceNo: '', receiptType: '' })).toBe('Please select the invoice')
    expect(receiptProblem({ ...ok, receiptType: '', receiptDate: '' })).toBe('Please Enter Rec. Type')
    expect(receiptProblem({ ...ok, receiptDate: '', amount: '' })).toBe('Please Enter Receipt Date')
    expect(receiptProblem({ ...ok, amount: ' ' })).toBe('Please Enter Receipt Amount')
    expect(receiptProblem({ ...ok, amount: '0.00' })).toBe('Receipt Amount cannot be zero.')
  })
})

describe('overpaymentWarning', () => {
  it('warns above the balance only', () => {
    expect(overpaymentWarning(invoice(), 300)).toContain('209.72')
    expect(overpaymentWarning(invoice(), 209.72)).toBeNull()
  })

  it('warns when the invoice has nothing outstanding (fully paid or a zero bill)', () => {
    expect(overpaymentWarning(invoice({ invoiceNo: 'S34104', outstanding: 0 }), 100)).toBe(
      'Invoice S34104 has no outstanding balance (0.00). Save the receipt anyway?',
    )
    expect(overpaymentWarning(invoice({ outstanding: -100 }), 1)).toContain('-100.00')
  })
})
