import { describe, expect, it } from 'vitest'
import {
  alreadyListed,
  bordxColumns,
  bordxLine,
  entryOf,
  noStaged,
  officialReceiptRows,
  overPaid,
  periodOf,
  saveProblem,
  saveRequest,
  searchDefaults,
  searchParams,
  searchProblem,
  splitContra,
  stage,
  stageDefaults,
  stageProblem,
  tick,
  updateProblem,
  updateRequest,
  wsColumns,
  wsLine,
} from './receiptPayorRules'
import type { BordxApiRow, EntryValues, SearchValues, StageValues, WsApiRow } from './receiptPayorRules'

const bordx = (over: Partial<BordxApiRow> = {}): BordxApiRow => ({
  bordxNo: 'NWK1',
  payorCode: 'WK',
  receiptNo: null,
  receiptDate: null,
  receiptAmt: null,
  accMonth: null,
  accYear: null,
  chequeNo: null,
  pvDate: null,
  pvNo: null,
  checkAmt: null,
  bordxStatus: null,
  remark: null,
  bordxDate: '2021-03-01T00:00:00',
  receiptPrefix: 'RB',
  bordxAmount: 1000,
  policyNo: 'POL',
  groupCompany: 'ACME',
  received: null,
  ...over,
})
const ws = (over: Partial<WsApiRow> = {}): WsApiRow => ({
  caseNo: 'WK00001',
  claimVersion: 2,
  bordxNo: 'NWK1',
  amount: 100,
  receiptNo: null,
  receiptDate: null,
  receiptAmt: null,
  accMonth: null,
  accYear: null,
  checkAmt: null,
  claimStatus: null,
  bankCharge: null,
  contraCaseNo: null,
  contraVersionNo: null,
  contraCaseAmt: null,
  gainLoss: null,
  misc: null,
  discount: null,
  writeOff: null,
  medixReceipt: null,
  payRemarks: null,
  chequeNo: null,
  remark: null,
  receiptIndex: null,
  bordxDate: null,
  claimCloseDate: null,
  receiptPrefix: 'RB',
  policyNo: null,
  groupCompany: null,
  memberNo: 'M1',
  coverId: '00',
  patientName: 'A PATIENT',
  received: null,
  pvNo: null,
  pvDate: null,
  ...over,
})
const entry = (over: Partial<EntryValues> = {}): EntryValues => ({
  pvNo: '',
  pvDate: '',
  chequeNo: 'C1',
  receiptAmt: '100',
  remark: '',
  receiptNo: '',
  receiptDate: '30/10/2026',
  accMonth: '10',
  accYear: '2026',
  ...over,
})
const values = (over: Partial<StageValues> = {}): StageValues => ({ ...stageDefaults, ...over })

describe('a bordx line', () => {
  it('shows Full with a receipt, Partial when partly received, and the amount outstanding', () => {
    expect(bordxLine(bordx())).toMatchObject({ status: '', amount: 1000, outstanding: 1000, received: 0, orgStatus: '' })
    expect(bordxLine(bordx({ receiptNo: 'RB1', checkAmt: 1000, received: 1000, bordxStatus: 'F' }))).toMatchObject({
      status: 'Full',
      outstanding: 0,
      received: 1000,
      orgStatus: 'F',
    })
    expect(bordxLine(bordx({ receiptNo: 'RB1', checkAmt: 400, received: 400, bordxStatus: 'P' }))).toMatchObject({ status: 'Partial', outstanding: 600 })
  })

  it('has the columns of the desktop after the tick box', () => {
    expect(bordxColumns.map((c) => c.label)).toEqual([
      'Status',
      'Bordx No',
      'Bordx Amt',
      'Receipt Amt',
      'OS Amt',
      'Paying',
      'OrgStatus',
      'PVNo',
      'PVDate',
      'ReceiptNo',
      'ReceiptDate',
      'AC Period',
      'ReceiptChq',
      'PVRemark',
      'ChqAmt',
      'BordxDate',
      'RecInd',
      'Group Company',
      'Policy Number',
    ])
    expect(
      bordxColumns.map((c) =>
        c.value(bordxLine(bordx({ receiptNo: 'RB1', receiptAmt: 5000, checkAmt: 1000, received: 1000, accMonth: 4, accYear: 2021, bordxStatus: 'F' }))),
      ),
    ).toEqual(['Full', 'NWK1', '1,000.00', '1,000.00', '0.00', '', 'F', '', '', 'RB1', '', '4-2021', '', '', '5,000.00', '01/03/2021', 'RB', 'ACME', 'POL'])
  })
})

describe('ticking a bordx', () => {
  it('pays what is outstanding and undoes it', () => {
    const on = tick(bordxLine(bordx()), true, false)
    expect(on.line).toMatchObject({ status: 'Full', paying: 1000, outstanding: 0 })
    expect(on.delta).toBe(1000)
    const off = tick(on.line, false, false)
    expect(off.line).toMatchObject({ status: '', paying: 0, outstanding: 1000 })
    expect(off.delta).toBe(-1000)
  })

  it('refuses a bordx received in full to a user who is not authorised and takes it again for an authorised one', () => {
    const full = bordxLine(bordx({ receiptNo: 'RB1', checkAmt: 700, received: 700, bordxStatus: 'F' }))
    expect(tick(full, true, false)).toMatchObject({ refused: 'Record has been paid !', delta: 0 })
    const again = tick(full, true, true)
    expect(again.line).toMatchObject({ paying: 700, status: 'Full' })
    expect(again.delta).toBe(700)
    expect(tick(again.line, false, true).line.status).toBe('Full')
  })

  it('refuses a partly received bordx to everybody and sends the user to By Worksheet', () => {
    const partial = bordxLine(bordx({ receiptNo: 'RB1', checkAmt: 400, received: 400, bordxStatus: 'P' }))
    expect(tick(partial, true, true).refused).toContain('Record has been Partial Paid !')
    expect(tick(partial, true, false).refused).toContain('Please Pay by Receipt Type - Worksheet !')
  })
})

describe('a claim line and ticking it', () => {
  it('shows what is outstanding from all the claim receipts and the patient', () => {
    expect(wsLine(ws({ checkAmt: 40, received: 70, claimStatus: 'P', receiptNo: 'RB1', receiptIndex: 9 }))).toMatchObject({
      status: 'Partial',
      amount: 100,
      received: 40,
      outstanding: 30,
      receiptIndex: 9,
      key: 'WK00001|2|9',
    })
    expect(wsColumns.map((c) => c.label)).toHaveLength(24)
    expect(wsColumns.slice(0, 8).map((c) => c.value(wsLine(ws())))).toEqual(['', 'NWK1', 'WK00001-2', '100.00', '0.00', '100.00', '', 'A PATIENT'])
  })

  it('pays what is outstanding: Full when it reaches the amount, Partial otherwise', () => {
    expect(tick(wsLine(ws()), true, false).line).toMatchObject({ status: 'Full', paying: 100, outstanding: 0 })
    const part = wsLine(ws({ checkAmt: 40, received: 40, claimStatus: 'P', receiptNo: 'RB1', receiptIndex: 9 }))
    const on = tick(part, true, false)
    expect(on.line).toMatchObject({ paying: 60, status: 'Full', receiptIndex: 9 })
    expect(on.delta).toBe(60)
    const off = tick(on.line, false, false)
    expect(off.line).toMatchObject({ paying: 0, status: 'Partial', outstanding: 60 })
    expect(off.delta).toBe(-60)
    expect(tick(wsLine(ws()), false, false).line.status).toBe('')
  })

  it('refuses a claim received in full to a user who is not authorised; an authorised user pays the amount again on a new receipt row', () => {
    const full = wsLine(ws({ checkAmt: 100, received: 100, claimStatus: 'F', receiptNo: 'RB1', receiptIndex: 9 }))
    expect(tick(full, true, false).refused).toBe('Record has been paid !')
    const again = tick(full, true, true)
    expect(again.line).toMatchObject({ paying: 100, receiptIndex: null })
    expect(again.delta).toBe(100)
  })
})

describe('staging a claim (CmdAdd_Click)', () => {
  const ticked = tick(wsLine(ws()), true, false).line

  it('checks the contra case and its amount and warns of an over payment', () => {
    expect(stageProblem(values({ contraCase: 'X' }))?.field).toBe('contraCase')
    expect(stageProblem(values({ contraCase: 'X', contraVersion: '1' }))).toEqual({ field: 'contraAmt', message: 'Please Keyin Contra Case Amount ' })
    expect(stageProblem(values({ contraCase: 'X', contraVersion: '1', contraAmt: '2' }))).toBeNull()
    expect([overPaid(ticked, values({ amtPaid: '100.01' })), overPaid(ticked, values({ amtPaid: '100' }))]).toEqual([true, false])
  })

  it('makes the claim Partial for less than the amount, with what is left outstanding, and copies the boxes', () => {
    const r = stage(ticked, values({ amtPaid: '60', bankCharge: '1', contraCase: 'TA2', contraVersion: '1', contraAmt: '9', casRemark: ' r ' }))
    expect(r.line).toMatchObject({ paying: 60, status: 'Partial', outstanding: 40 })
    expect(r.delta).toBe(-40)
    expect(r.line.staged).toEqual({ ...noStaged, bankCharge: '1', contra: 'TA2-1', contraAmt: '9', casRemark: 'r' })
    expect(stage(ticked, values({ amtPaid: '100' })).line.status).toBe('Full')
  })
})

describe('Save, Update and the request', () => {
  it('checks Save in the desktop order', () => {
    expect(saveProblem(entry(), 0, 0)).toEqual({ field: 'list', message: 'Please select at least one record to be updated! ' })
    expect(saveProblem(entry({ receiptAmt: '' }), 1, 100)).toEqual({ field: 'receiptAmt', message: 'Please Enter Receipt Amt!' })
    expect(saveProblem(entry({ chequeNo: '' }), 1, 100)).toEqual({ field: 'chequeNo', message: 'Please Enter Cheque No!' })
    expect(saveProblem(entry({ receiptDate: '' }), 1, 100)).toEqual({ field: 'receiptDate', message: 'Please Enter Receipt Date' })
    expect(saveProblem(entry(), 1, 90)).toEqual({ field: 'remark', message: 'Please Enter Remark!' })
    expect(saveProblem(entry({ remark: 'short paid' }), 1, 90)).toBeNull()
    expect(saveProblem(entry(), 1, 100)).toBeNull()
  })

  it('checks Update in the desktop order', () => {
    expect(updateProblem(entry(), 0)?.message).toBe('Please select the record')
    expect(updateProblem(entry({ receiptAmt: '' }), 1)?.message).toBe('Please Enter Rec Amt!')
    expect(updateProblem(entry({ chequeNo: '' }), 1)?.message).toBe('Please Enter Cheque No!')
    expect(updateProblem(entry({ receiptDate: '' }), 1)?.message).toBe('Please Enter Receipt Date')
    expect(updateProblem(entry(), 1)).toBeNull()
  })

  it('sends the bordx numbers or the claims with their amounts', () => {
    const b = saveRequest(
      'bordx',
      entry({ remark: ' r ' }),
      [tick(bordxLine(bordx()), true, false).line, tick(bordxLine(bordx({ bordxNo: 'NWK2' })), true, false).line],
      2000,
    )
    expect(b).toMatchObject({
      mode: 'bordx',
      receiptAmt: 100,
      chequeNo: 'C1',
      receiptDate: '2026-10-30',
      accMonth: 10,
      remark: 'r',
      checkedAmount: 2000,
      bordxNos: ['NWK1', 'NWK2'],
      items: [],
    })
    const line = stage(tick(wsLine(ws()), true, false).line, values({ amtPaid: '60', contraCase: 'TA2', contraVersion: '1', contraAmt: '9' })).line
    const w = saveRequest('worksheet', entry(), [line], 60)
    expect(w.bordxNos).toEqual([])
    expect(w.items[0]).toMatchObject({
      caseNo: 'WK00001',
      version: 2,
      bordxNo: 'NWK1',
      status: 'P',
      paymentAmt: 60,
      contraCase: 'TA2',
      contraVersion: '1',
      contraAmt: 9,
    })
  })

  it('sends Update for one bordx or one claim with its receipt row, Full when the amount paid less what the row received reaches the amount', () => {
    const u = updateRequest('bordx', { ...entry({ receiptNo: 'RB1' }), ...stageDefaults }, bordxLine(bordx()))
    expect(u).toMatchObject({ receiptNo: 'RB1', bordxNos: ['NWK1'], items: [] })
    const line = wsLine(ws({ checkAmt: 40, received: 40, receiptNo: 'RB1', receiptIndex: 9 }))
    const part = updateRequest('worksheet', { ...entry({ receiptNo: 'RB1' }), ...values({ amtPaid: '50' }) }, line)
    expect(part.items[0]).toMatchObject({ status: 'P', paymentAmt: 50, receiptIndex: 9 })
    expect(updateRequest('worksheet', { ...entry({ receiptNo: 'RB1' }), ...values({ amtPaid: '140' }) }, line).items[0].status).toBe('F')
  })

  it('shows a line in the boxes', () => {
    const loaded = entryOf(
      wsLine(
        ws({
          receiptNo: 'RB1',
          receiptDate: '2021-04-21T00:00:00',
          receiptAmt: 500,
          chequeNo: 'ONLINE',
          accMonth: 4,
          accYear: 2021,
          checkAmt: 40,
          contraCaseNo: 'X',
          contraVersionNo: '1',
          contraCaseAmt: 2,
        }),
      ),
    )
    expect(loaded.entry).toMatchObject({ receiptNo: 'RB1', receiptDate: '21/04/2021', receiptAmt: '500', chequeNo: 'ONLINE', accMonth: '4', accYear: '2021' })
    expect(loaded.stage).toMatchObject({ contraCase: 'X', contraVersion: '1', contraAmt: '2', amtPaid: '40' })
    expect(loaded.claim).toBe('WK00001-2')
    expect(entryOf(bordxLine(bordx({ receiptNo: 'RB9', receiptAmt: 7 }))).entry).toMatchObject({ receiptNo: 'RB9', receiptAmt: '7' })
    expect(periodOf('30/10/2026')).toEqual({ month: '10', year: '2026' })
    expect(splitContra('X-2')).toEqual({ contraCase: 'X', contraVersion: '2' })
  })
})

describe('searching', () => {
  const v = (over: Partial<SearchValues> = {}): SearchValues => ({ ...searchDefaults, ...over })

  it('needs the bordx or the worksheet for a scan', () => {
    expect(searchProblem(v())).toBeNull()
    expect(searchProblem(v({ scan: true }))).toEqual({ field: 'bordxFrom', message: 'Please Enter Bordx No' })
    expect(searchProblem(v({ scan: true, mode: 'worksheet' }))).toEqual({ field: 'wsFrom', message: 'Please Enter Worksheet No' })
    expect(searchProblem(v({ scan: true, bordxFrom: 'B1' }))).toBeNull()
  })

  it('sends the criteria of the receipt type, dates as ISO days', () => {
    expect(searchParams(v({ scan: true, bordxFrom: ' b1 ', bordxTo: 'B9', status: '3' }))).toMatchObject({
      mode: 'bordx',
      scan: true,
      bordxFrom: 'b1',
      bordxTo: undefined,
      status: 3,
    })
    expect(searchParams(v({ mode: 'worksheet', scan: true, wsFrom: 'WK1', wsTo: 'WK9', wsStatus: '2', closeFrom: '01/09/2026', mthFrom: '4' }))).toMatchObject({
      wsFrom: 'WK1',
      wsTo: undefined,
      wsStatus: 2,
      closeFrom: '2026-09-01',
      mthFrom: 4,
    })
    expect(searchParams(v({ bordxFrom: 'B1', bordxTo: 'B9' }))).toMatchObject({ bordxTo: 'B9' })
  })

  it('knows a bordx or a worksheet that is in the list already', () => {
    expect(alreadyListed([bordxLine(bordx())], 'bordx', ' nwk1 ')).toBe(true)
    expect(alreadyListed([wsLine(ws())], 'worksheet', 'WK00001')).toBe(true)
    expect(alreadyListed([wsLine(ws())], 'worksheet', 'WK00002')).toBe(false)
  })
})

describe('the official receipt', () => {
  it('writes the receipt and one line per bordx', () => {
    const line = { receiptNo: 'RB1', receiptDate: '2021-04-21T00:00:00', bordxNo: 'NWK1', receiptAmt: 500, chequeNo: 'ONLINE', payorName: 'A PAYOR' }
    const rows = officialReceiptRows([line, { ...line, bordxNo: 'NWK2' }])
    expect(rows.slice(0, 6)).toEqual([
      ['Official Receipt'],
      ['Receipt No', 'RB1'],
      ['Received from', 'A PAYOR'],
      ['Receipt Date', '21/04/2021'],
      ['Amount', '500.00'],
      ['Cheque No', 'ONLINE'],
    ])
    expect(rows.slice(7)).toEqual([
      ['No', 'Bordx No'],
      ['1', 'NWK1'],
      ['2', 'NWK2'],
    ])
  })
})
