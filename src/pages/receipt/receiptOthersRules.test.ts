import { describe, expect, it } from 'vitest'
import {
  entryDefaults,
  entryFromRow,
  entryRequest,
  entrySchema,
  hospitalOptions,
  periodOf,
  receiptColumns,
  saveProblem,
  searchDefaults,
  searchParams,
  updateProblem,
} from './receiptOthersRules'
import type { EntryValues, ReceiptRow } from './receiptOthersRules'

const full: EntryValues = {
  hospital: 'H1 - Hospital 1',
  receiptNo: 'R1',
  receiptDate: '04/03/2026',
  amount: '1234.50',
  bankCharge: '12.34',
  chequeNo: 'C1',
  accMonth: '3',
  accYear: '2026',
  remarks: 'x',
}
const row: ReceiptRow = {
  id: 7,
  hospitalCode: 'H1',
  hospitalName: 'Hospital 1',
  receiptNo: 'R1',
  receiptDate: '2026-03-04T00:00:00',
  amount: 1234.5,
  bankCharge: null,
  chequeNo: 'C1',
  remarks: null,
  accMonth: 3,
  accYear: 2026,
  updatedBy: 'U',
  updatedOn: null,
}

describe('Receipt (Others)', () => {
  it('Save asks for the boxes in the desktops order with its messages', () => {
    expect(saveProblem(entryDefaults)?.message).toBe('Please Enter Hospital Code')
    expect(saveProblem({ ...entryDefaults, hospital: 'H1 - X' })?.message).toBe('Please Enter Receipt No')
    expect(saveProblem({ ...entryDefaults, hospital: 'H1 - X', receiptNo: 'R' })?.message).toBe('Please Enter Receipt Date')
    expect(saveProblem({ ...entryDefaults, hospital: 'H1 - X', receiptNo: 'R', receiptDate: '01/01/2026' })?.message).toBe('Please Enter Receipt Amount')
    expect(saveProblem({ ...entryDefaults, hospital: 'H1 - X', receiptNo: 'R', receiptDate: '01/01/2026', amount: '1' })?.message).toBe(
      'Please Enter Cheque No',
    )
    expect(saveProblem(full)).toBeNull()
  })

  it('Update has its own messages and asks for the cheque no before the amount', () => {
    expect(updateProblem(full, null)?.message).toBe('Please select the record')
    expect(updateProblem({ ...full, hospital: '' }, row)?.message).toBe('Please Enter Hospital Name!')
    expect(updateProblem({ ...full, receiptNo: '' }, row)?.message).toBe('Please Enter Receipt No!')
    expect(updateProblem({ ...full, receiptDate: '31/02/2026' }, row)?.message).toBe('Invalid Receipt Date!')
    expect(updateProblem({ ...full, receiptDate: '' }, row)?.message).toBe('Please Enter Receipt Date')
    expect(updateProblem({ ...full, chequeNo: '', amount: '' }, row)?.message).toBe('Please Enter Cheque No!')
    expect(updateProblem({ ...full, amount: '' }, row)?.message).toBe('Please Enter Cheque Amt!')
    expect(updateProblem(full, row)).toBeNull()
  })

  it('fills the A/C period from a valid receipt date', () => {
    expect(periodOf('04/03/2026')).toEqual({ accMonth: '3', accYear: '2026' })
    expect(periodOf('31/02/2026')).toBeNull()
    expect(periodOf('')).toBeNull()
  })

  it('sends the hospital code, ISO dates and numbers', () => {
    expect(entryRequest(full)).toEqual({
      hospital: 'H1',
      receiptNo: 'R1',
      receiptDate: '2026-03-04',
      amount: 1234.5,
      bankCharge: 12.34,
      chequeNo: 'C1',
      accMonth: 3,
      accYear: 2026,
      remarks: 'x',
    })
    expect(entryRequest({ ...full, bankCharge: '', accMonth: '', accYear: '' })).toMatchObject({
      bankCharge: undefined,
      accMonth: undefined,
      accYear: undefined,
    })
    expect(
      searchParams({ ...searchDefaults, hospital: 'H1 - Hospital 1', noFrom: ' R1 ', dateFrom: '04/03/2026', monthFrom: '3', blankYear: true }),
    ).toMatchObject({
      hospital: 'H1',
      noFrom: 'R1',
      dateFrom: '2026-03-04',
      monthFrom: 3,
      blankYear: true,
      noTo: undefined,
    })
  })

  it('loads a receipt into the boxes, a hospital that is not in the list showing as its code', () => {
    expect(entryFromRow(row, [{ code: 'H1', name: 'Hospital 1' }])).toEqual({ ...full, bankCharge: '', remarks: '', amount: '1234.5' })
    expect(entryFromRow({ ...row, hospitalCode: 'OTHER', hospitalName: null }, [{ code: 'H1', name: 'Hospital 1' }]).hospital).toBe('OTHER')
    expect(hospitalOptions([{ code: 'H1', name: 'Hospital 1' }])).toEqual([{ value: 'H1 - Hospital 1', label: 'H1 - Hospital 1' }])
  })

  it('lists the receipts as the desktop did', () => {
    expect(receiptColumns.map((c) => c.label)).toEqual(['Hospital Name', 'Receipt No', 'Receipt Date', 'Receipt Amt', 'Bank Charge', 'Cheque No', 'A/C Period'])
    expect(receiptColumns.map((c) => c.value(row))).toEqual(['Hospital 1', 'R1', '04/03/2026', '1,234.50', '', 'C1', '3/2026'])
    expect(receiptColumns.map((c) => c.value({ ...row, hospitalName: null, accMonth: null, accYear: null }))[0]).toBe('Empty')
  })

  it('checks the box lengths, the dates and the amounts', async () => {
    await expect(entrySchema.validate({ ...full, receiptNo: 'r'.repeat(31) })).rejects.toThrow('Receipt No is too long.')
    await expect(entrySchema.validate({ ...full, receiptDate: '31/02/2026' })).rejects.toThrow('Invalid Date Format!')
    await expect(entrySchema.validate({ ...full, amount: 'abc' })).rejects.toThrow('Enter a valid amount.')
    await expect(entrySchema.validate(full)).resolves.toBeTruthy()
  })
})
