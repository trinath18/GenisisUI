import { describe, expect, it } from 'vitest'
import { NO_DOCUMENTS, needsDocuments, selectionProblem } from './listingRules'
import type { TickableWorksheet } from './listingRules'

const worksheet = (over: Partial<TickableWorksheet> = {}): TickableWorksheet => ({
  dod: '23/07/2021',
  hospital: 'PANTAI HOSPITAL',
  claimability: 'AA',
  hltType: 'N',
  insuredType: 'I',
  groupCompany: '',
  ...over,
})

describe('selectionProblem (lstWorksheetTrackList_ItemCheck)', () => {
  it('accepts a complete worksheet', () => expect(selectionProblem(worksheet())).toBeNull())

  it('checks in the desktop order: discharge date, hospital, claimability, group company', () => {
    expect(selectionProblem(worksheet({ dod: ' ', hospital: '' }))).toBe('Date of Discharge is Empty.')
    expect(selectionProblem(worksheet({ hospital: ' ', claimability: 'N' }))).toBe('Hospital cannot be empty!')
    expect(selectionProblem(worksheet({ claimability: 'N' }))).toBe('Claimability is Not Decided!')
  })

  it('keeps the desktop literal: a two-letter NN is not blocked', () => expect(selectionProblem(worksheet({ claimability: 'NN' }))).toBeNull())

  it.each(['G', 'H'])('requires a group company for health type N and insured type %s', (insuredType) => {
    expect(selectionProblem(worksheet({ insuredType }))).toBe('Group Company cannot be empty!')
    expect(selectionProblem(worksheet({ insuredType, groupCompany: 'ACME' }))).toBeNull()
  })

  it('does not ask a group company of other health types', () => expect(selectionProblem(worksheet({ hltType: 'M', insuredType: 'G' }))).toBeNull())
})

describe('needsDocuments', () => {
  it('exempts group worksheets (health type N, insured type G or H)', () => {
    expect(needsDocuments(worksheet({ insuredType: 'G' }))).toBe(false)
    expect(needsDocuments(worksheet({ insuredType: 'H' }))).toBe(false)
  })

  it('needs documents for everything else', () => {
    expect(needsDocuments(worksheet({ insuredType: 'I' }))).toBe(true)
    expect(needsDocuments(worksheet({ hltType: 'M', insuredType: 'G' }))).toBe(true)
  })

  it('has the legacy message', () => expect(NO_DOCUMENTS).toBe('Please ensure scanned documents are in system!'))
})
