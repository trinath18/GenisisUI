import { describe, expect, it } from 'vitest'
import {
  alreadyListed,
  entryOf,
  memberColumns,
  noStaged,
  officialReceiptRows,
  periodOf,
  saveProblem,
  saveRequest,
  searchDefaults,
  searchParams,
  splitContra,
  stage,
  stageDefaults,
  stageProblem,
  statusOptions,
  tick,
  toRow,
  updateProblem,
  updateRequest,
} from './receiptMemberRules'
import type { EntryValues, MemberApiRow, ReceiptApiRow, SearchValues, StageValues } from './receiptMemberRules'

const api = (over: Partial<MemberApiRow> = {}): MemberApiRow => ({
  debitNo: 'DTA1',
  paymentStatus: null,
  caseNo: 'TA00001',
  claimVersion: 2,
  payableByMedix: -100,
  receiptAmt: null,
  receiptIndex: null,
  receiptNo: null,
  receiptDate: null,
  accMonth: null,
  accYear: null,
  bankCharge: null,
  contraCaseNo: null,
  contraVersionNo: null,
  contraCaseAmt: null,
  gainLoss: null,
  misc: null,
  discount: null,
  amtPaid: null,
  writeOff: null,
  medixReceipt: null,
  remarks: null,
  memberNo: 'M1',
  memberName: 'A MEMBER',
  payorCode: 'TA',
  ...over,
})
const partial = api({
  paymentStatus: 'P',
  payableByMedix: -100,
  receiptAmt: 40,
  receiptIndex: 7,
  receiptNo: 'R1',
  receiptDate: '2026-09-01T00:00:00',
  accMonth: 9,
  accYear: 2026,
})
const full = api({ paymentStatus: 'F', payableByMedix: -100, receiptAmt: 100, receiptIndex: 8, receiptNo: 'R2' })
const entry = (over: Partial<EntryValues> = {}): EntryValues => ({
  receiptNo: 'R9',
  receiptDate: '30/10/2026',
  amount: '100',
  chequeNo: 'C1',
  receiptRemarks: '',
  accMonth: '',
  accYear: '',
  ...over,
})
const values = (over: Partial<StageValues> = {}): StageValues => ({ ...stageDefaults, ...over })

describe('a line of the list', () => {
  it('shows the debit note as a positive and what is outstanding for each payment status', () => {
    expect(toRow(api())).toMatchObject({ amount: 100, received: 0, status: '', outstanding: 100, key: 'TA00001|2|' })
    expect(toRow(partial)).toMatchObject({ amount: 100, received: 40, status: 'Partial', outstanding: 60, key: 'TA00001|2|7' })
    expect(toRow(full)).toMatchObject({ status: 'Full', outstanding: 0 })
    expect(toRow(api({ contraCaseNo: 'TA2 ', contraVersionNo: '3', contraCaseAmt: 5 })).staged).toMatchObject({ contra: 'TA2-3', contraAmt: '5' })
  })

  it('has the columns of the desktop after the tick box', () => {
    expect(memberColumns.map((c) => c.label)).toEqual([
      'Reference No',
      'Pymt Status',
      'WKS No',
      'Amount',
      "Amt Rec'd",
      'OS Amt',
      'Amt Receiving',
      'ReceiptIndex',
      'Rept No',
      'Rept Date',
      'Acc Period',
      'Bank Charge',
      'Contra Case No',
      'Contra Amt',
      'Clm Gain Loss',
      'Misc Diff',
      'Discount',
      'Amt Paid',
      'Write Off',
      'Medix Receipt',
      'Remarks',
    ])
    expect(memberColumns.map((c) => c.value(toRow(partial)))).toEqual([
      'DTA1',
      'Partial',
      'TA00001-2',
      '100.00',
      '40.00',
      '60.00',
      '',
      '7',
      'R1',
      '01/09/2026',
      '9/2026',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ])
    expect(statusOptions.map((o) => o.label)).toHaveLength(6)
  })
})

describe('ticking a debit note (ProcessCheckedItem)', () => {
  it('makes a row with no receipt Full for the whole amount', () => {
    const t = tick(toRow(api()), true, false)
    expect(t.row).toMatchObject({ status: 'Full', receiving: 100, outstanding: 0 })
    expect(t.delta).toBe(100)
  })

  it('makes a partly paid row Full for what is outstanding', () => {
    const t = tick(toRow(partial), true, false)
    expect(t.row).toMatchObject({ status: 'Full', receiving: 60, outstanding: 0 })
    expect(t.delta).toBe(60)
    expect(tick(toRow(partial), true, true).row).toMatchObject({ status: 'Full', receiving: 60 })
  })

  it('refuses a row that is paid in full for a user who is not authorised and takes it again for one who is', () => {
    expect(tick(toRow(full), true, false)).toMatchObject({ refused: 'Payment has been made!', delta: 0 })
    const t = tick(toRow(full), true, true)
    expect(t.row).toMatchObject({ status: 'Full', receiving: 100, outstanding: null, received: null })
    expect(t.delta).toBe(100)
  })

  it('puts a row back as listed when it is unticked and clears what was staged', () => {
    const ticked = tick(toRow(api()), true, false).row
    const staged = stage(ticked, values({ bankCharge: '2', contraCase: 'X', contraVersion: '1', contraAmt: '3', remarks: 'r' })).row
    expect(staged.staged.bankCharge).toBe('2')
    const off = tick(staged, false, false)
    expect(off.row).toMatchObject({ status: '', receiving: null, outstanding: 100, staged: noStaged })
    expect(off.delta).toBe(-100)
    const offPartial = tick(tick(toRow(partial), true, false).row, false, false)
    expect(offPartial.row).toMatchObject({ status: 'Partial', outstanding: 60, receiving: null })
    expect(offPartial.delta).toBe(-60)
    expect(tick(toRow(full), false, true)).toMatchObject({ delta: -100, row: { status: 'Full', outstanding: null, received: 100 } })
  })
})

describe('staging the amounts of a ticked claim (CmdAdd_Click)', () => {
  const ticked = tick(toRow(api()), true, false).row

  it('checks the contra case, its amount and the amount paid in the desktop order', () => {
    expect(stageProblem(ticked, values({ contraCase: 'X' }))).toEqual({
      field: 'contraCase',
      message: 'Invalid Contra Case..., Please Keyin Contra Case No. or Contra Version ',
    })
    expect(stageProblem(ticked, values({ contraVersion: '1' }))?.field).toBe('contraCase')
    expect(stageProblem(ticked, values({ contraCase: 'X', contraVersion: '1' }))).toEqual({ field: 'contraAmt', message: 'Please Keyin Contra Case Amount ' })
    expect(stageProblem(ticked, values({ amtPaid: '100.01' }))).toEqual({ field: 'amtPaid', message: 'Invalid Amount Paid ! ' })
    expect(stageProblem(ticked, values({ amtPaid: '100', contraCase: 'X', contraVersion: '1', contraAmt: '2' }))).toBeNull()
  })

  it('makes the claim Partial with the difference outstanding when less than the amount is paid', () => {
    const r = stage(ticked, values({ amtPaid: '60' }))
    expect(r.row).toMatchObject({ receiving: 60, status: 'Partial', outstanding: 40 })
    expect(r.delta).toBe(-40)
  })

  it('keeps it Full when the amount paid is the amount or what was being received', () => {
    expect(stage(ticked, values({ amtPaid: '100' })).row.status).toBe('Full')
    const again = stage(stage(ticked, values({ amtPaid: '60' })).row, values({ amtPaid: '60' }))
    expect(again.row.status).toBe('Full')
    expect(again.delta).toBe(0)
  })

  it('copies the other boxes, and an empty contra stays empty', () => {
    const r = stage(ticked, values({ bankCharge: '1.5', gainLoss: '2', misc: '3', discount: '4', writeOff: '5', medixRec: '6', remarks: 'x' })).row
    expect(r.staged).toEqual({
      bankCharge: '1.5',
      contra: '',
      contraAmt: '',
      gainLoss: '2',
      misc: '3',
      discount: '4',
      writeOff: '5',
      medixRec: '6',
      remarks: 'x',
    })
    expect(stage(ticked, values({ contraCase: 'TA2', contraVersion: '1', contraAmt: '9' })).row.staged.contra).toBe('TA2-1')
  })
})

describe('Save and Update', () => {
  it('checks Save in the desktop order', () => {
    expect(saveProblem(entry({ receiptNo: '' }))).toEqual({ field: 'receiptNo', message: 'Please Enter Receipt No' })
    expect(saveProblem(entry({ receiptDate: '' }))).toEqual({ field: 'receiptDate', message: 'Please Enter Receipt Date' })
    expect(saveProblem(entry({ amount: '' }))).toEqual({ field: 'amount', message: 'Please Enter Amount' })
    expect(saveProblem(entry({ chequeNo: ' ' }))).toEqual({ field: 'chequeNo', message: 'Please Enter Cheque No' })
    expect(saveProblem(entry())).toBeNull()
  })

  it('checks Update in the desktop order', () => {
    expect(updateProblem(entry(), 0)).toEqual({ field: 'list', message: 'Please select the record' })
    expect(updateProblem(entry({ receiptNo: '' }), 1)).toEqual({ field: 'receiptNo', message: 'Please Enter Receipt No!' })
    expect(updateProblem(entry({ receiptDate: '31/02/2026' }), 1)).toEqual({ field: 'receiptDate', message: 'Invalid Receipt Date!' })
    expect(updateProblem(entry({ receiptDate: '' }), 1)).toEqual({ field: 'receiptDate', message: 'Please Enter Receipt Date' })
    expect(updateProblem(entry({ chequeNo: '' }), 1)).toEqual({ field: 'chequeNo', message: 'Please Enter Cheque No!' })
    expect(updateProblem(entry({ amount: '' }), 1)).toEqual({ field: 'amount', message: 'Please Enter Cheque Amt!' })
    expect(updateProblem(entry(), 1)).toBeNull()
  })

  it('takes the account period from the receipt date and splits the contra case at the first dash', () => {
    expect(periodOf('30/10/2026')).toEqual({ month: '10', year: '2026' })
    expect(periodOf('05/01/2026')).toEqual({ month: '1', year: '2026' })
    expect(periodOf('')).toBeNull()
    expect(splitContra('TA00002-3')).toEqual({ contraCase: 'TA00002', contraVersion: '3' })
    expect(splitContra('-')).toEqual({ contraCase: undefined, contraVersion: undefined })
    expect(splitContra('')).toEqual({ contraCase: undefined, contraVersion: undefined })
  })

  it('sends the receipt and each ticked claim with its status and amounts', () => {
    const ticked = tick(toRow(api()), true, false).row
    const staged = stage(ticked, values({ amtPaid: '60', bankCharge: '1', contraCase: 'TA2', contraVersion: '1', contraAmt: '9', remarks: ' r ' })).row
    const request = saveRequest(entry({ receiptRemarks: ' note ', accMonth: '10', accYear: '2026' }), [staged, tick(toRow(partial), true, true).row])
    expect(request).toMatchObject({ receiptNo: 'R9', receiptDate: '2026-10-30', amount: 100, chequeNo: 'C1', remarks: 'note', accMonth: 10, accYear: 2026 })
    expect(request.items[0]).toMatchObject({
      caseNo: 'TA00001',
      version: 2,
      status: 'P',
      paymentAmt: 60,
      bankCharge: 1,
      contraCase: 'TA2',
      contraVersion: '1',
      contraAmt: 9,
      remarks: 'r',
    })
    expect(request.items[1]).toMatchObject({ status: 'F', paymentAmt: 60, contraCase: undefined })
  })

  it('loads a receipt row into the boxes and sends the changes of Update, an empty box as nothing', () => {
    const loaded = entryOf({
      receiptNo: 'R1',
      receiptDate: '2026-09-01T00:00:00',
      receiptAmt: 40,
      chequeNo: 'C1',
      receiptRemarks: null,
      accMonth: 9,
      accYear: 2026,
      caseNo: 'TA00001',
      claimVersion: 2,
      bankCharge: 1,
      contraCaseNo: 'X',
      contraVersionNo: '1',
      contraCaseAmt: 2,
      gainLoss: null,
      misc: null,
      discount: null,
      amtPaid: 0,
      writeOff: null,
      medixReceipt: null,
      remarks: 'r',
    } as ReceiptApiRow)
    expect(loaded.entry).toMatchObject({ receiptNo: 'R1', receiptDate: '01/09/2026', amount: '40', accMonth: '9' })
    expect(loaded.stage).toMatchObject({ bankCharge: '1', contraCase: 'X', contraVersion: '1', contraAmt: '2', amtPaid: '0', remarks: 'r' })
    expect(loaded.claim).toBe('TA00001-2')
    expect(updateRequest(loaded.entry, loaded.stage, 7)).toMatchObject({
      receiptIndex: 7,
      receiptDate: '2026-09-01',
      bankCharge: 1,
      gainLoss: undefined,
      contraCase: 'X',
      contraAmt: 2,
      amtPaid: 0,
    })
  })
})

describe('searching', () => {
  const v = (over: Partial<SearchValues> = {}): SearchValues => ({ ...searchDefaults, ...over })

  it('is a scan of one worksheet by default and a range otherwise', () => {
    expect(searchParams(v({ caseFrom: ' ta1 ', caseTo: 'TA9' }))).toMatchObject({ scan: true, caseFrom: 'ta1', caseTo: undefined, status: 0 })
    expect(
      searchParams(v({ scan: false, caseFrom: 'TA1', caseTo: 'TA9', status: '3', amtFrom: '10', recDateFrom: '01/09/2026', mthEmpty: true })),
    ).toMatchObject({
      scan: false,
      caseTo: 'TA9',
      status: 3,
      amtFrom: 10,
      recDateFrom: '2026-09-01',
      mthEmpty: true,
    })
  })

  it('knows a worksheet that is in the list already', () => {
    expect(alreadyListed([toRow(api())], ' ta00001 ')).toBe(true)
    expect(alreadyListed([toRow(api())], 'TA00002')).toBe(false)
  })
})

describe('the official receipt', () => {
  it('writes the receipt and one line per claim', () => {
    const line = {
      caseNo: 'TA00001',
      claimVersion: '2',
      receiptNo: 'R1',
      receiptDate: '2026-09-01T00:00:00',
      healthType: 'S',
      chequeNo: 'C1',
      receiptAmt: 40,
      debitNo: 'DTA1',
      memberName: 'A MEMBER',
      patientName: 'A CHILD',
    }
    const rows = officialReceiptRows([line, { ...line, caseNo: 'TA00002', patientName: 'B' }])
    expect(rows.slice(0, 6)).toEqual([
      ['Official Receipt (Sihat)'],
      ['Receipt No', 'R1'],
      ['Received from', 'A MEMBER'],
      ['Receipt Date', '01/09/2026'],
      ['Amount', '40.00'],
      ['Cheque No', 'C1'],
    ])
    expect(rows.slice(7)).toEqual([
      ['Patient', 'DR No', 'Claim No'],
      ['A CHILD', 'DTA1', 'TA00001-2'],
      ['B', 'DTA1', 'TA00002-2'],
    ])
    expect(officialReceiptRows([{ ...line, healthType: 'N' }])[0]).toEqual(['Official Receipt'])
  })
})
