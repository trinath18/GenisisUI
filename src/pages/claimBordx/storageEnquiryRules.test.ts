import { describe, expect, it } from 'vitest'
import {
  cartonDefaults,
  cartonParams,
  cartonStatusOptions,
  checkSheetRows,
  fileDefaults,
  fileParams,
  fileSearchProblem,
  fileStatusOptions,
  isCaseListed,
  listingProblem,
} from './storageEnquiryRules'

describe('Storage Enquiry checks', () => {
  it('needs a case number in a scan, and none in a range', () => {
    expect(fileSearchProblem({ useScan: true, caseFrom: ' ' })).toBe('Please Enter Case No')
    expect(fileSearchProblem({ useScan: true, caseFrom: 'AB1' })).toBeNull()
    expect(fileSearchProblem({ useScan: false, caseFrom: '' })).toBeNull()
  })

  it('refuses a case that is already in the list, trimmed and in any case', () => {
    expect(isCaseListed([{ caseNo: 'AB00001' }], ' ab00001 ')).toBe(true)
    expect(isCaseListed([{ caseNo: 'AB00001' }], 'AB00002')).toBe(false)
  })

  it('needs a carton number for the listing, with the desktop message', () => {
    expect(listingProblem(' ')).toBe('Please select Carton No.')
    expect(listingProblem('C1')).toBeNull()
  })

  it('offers the desktop drop-down entries', () => {
    expect(cartonStatusOptions.map((o) => o.label)).toEqual(['M - Medix', 'S - Store', 'R - Return'])
    expect(fileStatusOptions.map((o) => o.label)).toEqual(['I - In', 'O - Out'])
  })
})

describe('Storage Enquiry requests', () => {
  it('starts a storage search as a scan', () => {
    expect(fileDefaults.useScan).toBe(true)
  })

  it('sends dates as ISO days, the payor as its code and ignores the range end in a scan', () => {
    const v = {
      ...fileDefaults,
      caseFrom: ' ab1 ',
      caseTo: 'AB9',
      registerFrom: '01/04/2021',
      payorFrom: 'AB - A PAYOR',
      payorTo: 'XL - OTHER',
      fileStatus: 'I',
    }
    const scan = fileParams(v)
    expect([scan.caseFrom, scan.caseTo, scan.registerFrom, scan.payorFrom, scan.payorTo, scan.fileStatus]).toEqual([
      'ab1',
      undefined,
      '2021-04-01',
      'AB',
      'XL',
      'I',
    ])
    expect(fileParams({ ...v, useScan: false }).caseTo).toBe('AB9')
  })

  it('sends the carton criteria with blanks left out', () => {
    expect(cartonParams({ ...cartonDefaults, cartonFrom: ' 0039 ', status: 'S', sendFrom: '01/01/2019', destroyTo: '31/12/2019' })).toEqual({
      cartonFrom: '0039',
      cartonTo: undefined,
      status: 'S',
      sendFrom: '2019-01-01',
      sendTo: undefined,
      requestFrom: undefined,
      requestTo: undefined,
      deliveryFrom: undefined,
      deliveryTo: undefined,
      returnFrom: undefined,
      returnTo: undefined,
      destroyFrom: undefined,
      destroyTo: '2019-12-31',
    })
  })

  it('numbers the check sheet and joins the case and version', () => {
    expect(
      checkSheetRows([
        { caseNo: 'AB1', claimVersion: '2', fileStatus: 'I' },
        { caseNo: 'AB2', claimVersion: '1', fileStatus: null },
      ]),
    ).toEqual([
      { no: 1, caseNo: 'AB1-2', checking: 'I' },
      { no: 2, caseNo: 'AB2-1', checking: '' },
    ])
  })
})
