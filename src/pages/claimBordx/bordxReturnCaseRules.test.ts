import { describe, expect, it } from 'vitest'
import { returnCaseDay, returnCaseRequest, returnCaseSearchProblem, returnCaseStatusOptions, returnCaseUpdateProblem } from './bordxReturnCaseRules'
import type { ReturnCaseRow } from './bordxReturnCaseRules'

const row: ReturnCaseRow = {
  payor: 'AB',
  caseNo: 'AB00001',
  claimVersion: 2,
  claimNo: 'AB00001-2',
  approvedAmount: 100,
  appStatus: null,
  bordxNo: 'NAB0000001',
  bordxDate: '2021-04-01T00:00:00',
  bordxAmount: 500,
  bordxStatus: 'C',
}

describe('Returned Fr Payor (Not App) checks', () => {
  it('needs a case number to search, with the desktop message', () => {
    expect(returnCaseSearchProblem('  ')).toBe('Please Enter Claim No')
    expect(returnCaseSearchProblem(' AB00001 ')).toBeNull()
  })

  it('checks the approved status first and then that a worksheet was looked up', () => {
    expect(returnCaseUpdateProblem('', null)).toBe('Please Enter Approved Status')
    expect(returnCaseUpdateProblem('N', null)).toBe('Please Enter Claim No')
    expect(returnCaseUpdateProblem('Y', row)).toBeNull()
  })

  it('offers N - No and Y - Yes', () => {
    expect(returnCaseStatusOptions.map((o) => o.label)).toEqual(['N - No', 'Y - Yes'])
  })

  it('sends the worksheet and the status in upper case', () => {
    expect(returnCaseRequest(row, ' y ')).toEqual({ caseNo: 'AB00001', version: 2, status: 'Y' })
  })

  it('shows dates as dd/mm/yyyy', () => {
    expect(returnCaseDay('2021-04-01T00:00:00')).toBe('01/04/2021')
    expect(returnCaseDay(null)).toBe('')
  })
})
