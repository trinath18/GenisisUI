import { describe, expect, it } from 'vitest'
import { reviseConfirmText, reviseDay, reviseKey, reviseLookupProblem, reviseRemoveProblem, reviseRequest } from './bordxReviseRules'

describe('Remove Worksheet checks', () => {
  it('needs a bordx number to look up, with the desktop message', () => {
    expect(reviseLookupProblem('  ')).toBe('Please select a Bordx No')
    expect(reviseLookupProblem(' NUB0000371 ')).toBeNull()
  })

  it('needs something ticked to remove', () => {
    expect(reviseRemoveProblem(0)).toBe('Please select at least one record to be removed!')
    expect(reviseRemoveProblem(2)).toBeNull()
  })

  it('asks the desktop question before removing', () => {
    expect(reviseConfirmText).toBe('You are going to remove a worksheet from current Bordereaux.\nAre you sure?')
  })
})

describe('Remove Worksheet request and list', () => {
  it('sends the trimmed bordx number and the ticked worksheets as case and version', () => {
    expect(
      reviseRequest(' NUB0000371 ', [
        { caseNo: 'UB00004485', claimVersion: 1 },
        { caseNo: 'UB00004503', claimVersion: 2 },
      ]),
    ).toEqual({
      bordxNo: 'NUB0000371',
      items: [
        { caseNo: 'UB00004485', claimVersion: 1 },
        { caseNo: 'UB00004503', claimVersion: 2 },
      ],
    })
  })

  it('keys a row by case and version and shows dates as dd/mm/yyyy', () => {
    expect(reviseKey({ caseNo: 'UB00004485', claimVersion: 1 })).toBe('UB00004485-1')
    expect(reviseDay('2021-08-06T00:00:00')).toBe('06/08/2021')
    expect(reviseDay(null)).toBe('')
  })
})
