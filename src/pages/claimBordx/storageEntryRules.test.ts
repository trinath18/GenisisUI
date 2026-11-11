import { describe, expect, it } from 'vitest'
import {
  addProblem,
  cartonFormDefaults,
  cartonFromRow,
  cartonProblem,
  cartonSaveRequest,
  entryFileColumns,
  entrySearchDefaults,
  entrySearchParams,
  fileKey,
  fileSaveRequest,
  fileTickProblem,
  storeDefaults,
  storeFromFile,
  storeProblem,
} from './storageEntryRules'
import type { CartonFormValues, EntryFileRow, StoreValues } from './storageEntryRules'
import type { CartonRow } from './storageEnquiryRules'

const file = (over: Partial<EntryFileRow> = {}): EntryFileRow =>
  ({
    caseNo: 'AB1',
    claimVersion: 2,
    cartonNo: null,
    cartonStatus: null,
    fileStatus: null,
    billAmount: 1200.5,
    sendDate: null,
    registerDate: null,
    requestBy: null,
    requestDate: null,
    deliveryDate: null,
    returnDate: null,
    duration: null,
    remarks: null,
    bordxDate: '2021-05-01T00:00:00',
    cashType: 'CL',
    ...over,
  }) as EntryFileRow

describe('Storage Entry search', () => {
  it('lists the claims that are not stored, takes the carton exactly and "A - All" as no status', () => {
    const p = entrySearchParams({ ...entrySearchDefaults, caseFrom: ' ab1 ', carton: 'C1', bordxFrom: '01/05/2021' })
    expect([p.includeUnstored, p.useScan, p.caseFrom, p.caseTo, p.cartonFrom, p.cartonTo, p.fileStatus, p.bordxFrom]).toEqual([
      true,
      true,
      'ab1',
      undefined,
      'C1',
      'C1',
      undefined,
      '2021-05-01',
    ])
    expect(entrySearchParams({ ...entrySearchDefaults, useScan: false, caseFrom: 'A', caseTo: 'B', fileStatus: 'I' })).toMatchObject({
      caseTo: 'B',
      fileStatus: 'I',
    })
  })

  it('refuses a claim that is stored already and asks for at least one', () => {
    expect(fileTickProblem(file({ cartonNo: 'C1' }))).toBe('Claim has been stored!')
    expect(fileTickProblem(file())).toBeNull()
    expect(addProblem(0)).toBe('Please checked at least 1 Claim !')
    expect(addProblem(2)).toBeNull()
    expect(fileKey(file())).toBe('AB1-2')
  })
})

describe('Storage Details checks', () => {
  const v = (over: Partial<StoreValues>): StoreValues => ({ ...storeDefaults, ...over })

  it('checks the carton, the file status and, with a request by, the dates, in the desktop order', () => {
    expect(storeProblem(v({}))?.message).toBe('Please Enter Carton Number')
    expect(storeProblem(v({ carton: 'C1' }))?.message).toBe('Please Enter File Status')
    expect(storeProblem(v({ carton: 'C1', fileStatus: 'I' }))).toBeNull()
    expect(storeProblem(v({ carton: 'C1', fileStatus: 'I', requestBy: 'A USER' }))?.message).toBe('Please Enter Date Of Request')
    expect(storeProblem(v({ carton: 'C1', fileStatus: 'I', requestBy: 'A USER', requestDate: '05/10/2026', deliveryDate: '02/10/2026' }))?.message).toBe(
      'Invalid Date ! Date of Delivery must greater than Date of Request',
    )
    expect(storeProblem(v({ carton: 'C1', fileStatus: 'I', requestBy: 'A USER', requestDate: '05/10/2026', returnDate: '09/10/2026' }))?.message).toBe(
      'Invalid Date ! Date of Return must greater than Date of Delivery',
    )
    expect(
      storeProblem(v({ carton: 'C1', fileStatus: 'O', requestBy: 'A USER', requestDate: '05/10/2026', deliveryDate: '06/10/2026', returnDate: '09/10/2026' })),
    ).toBeNull()
  })

  it('fills the form from a stored claim and builds the request', () => {
    const stored = file({ cartonNo: 'C1', fileStatus: 'I', requestBy: 'A USER', requestDate: '2026-10-05T00:00:00', remarks: 'kept' })
    expect(storeFromFile(stored)).toMatchObject({
      carton: 'C1',
      fileStatus: 'I',
      requestBy: 'A USER',
      requestDate: '05/10/2026',
      deliveryDate: '',
      remarks: 'kept',
    })
    expect(fileSaveRequest([file(), stored], v({ carton: ' C1 ', fileStatus: 'I', requestDate: '05/10/2026' }), false)).toMatchObject({
      files: [
        { caseNo: 'AB1', version: 2 },
        { caseNo: 'AB1', version: 2 },
      ],
      carton: 'C1',
      requestDate: '2026-10-05',
      edit: false,
    })
  })

  it('prints the list with the bordx date and the cash type', () => {
    expect(entryFileColumns.map((c) => c.label).slice(-2)).toEqual(['Bordx Date', 'Cash Type'])
    expect(entryFileColumns.map((c) => c.value(file())).slice(0, 6)).toEqual(['AB1', '2', '', '', '', '1,200.50'])
    expect(entryFileColumns.map((c) => c.value(file())).slice(-2)).toEqual(['01/05/2021', 'CL'])
  })
})

describe('Carton Details checks', () => {
  const v = (over: Partial<CartonFormValues>): CartonFormValues => ({ ...cartonFormDefaults, ...over })

  it('checks the carton number (when adding), the status and then each date against the one before it', () => {
    expect(cartonProblem(v({}), false)?.message).toBe('Please Enter Carton Number')
    expect(cartonProblem(v({}), true)?.message).toBe('Please Enter Carton Status')
    expect(cartonProblem(v({ cartonNo: 'C1', status: 'S' }), false)).toBeNull()
    expect(cartonProblem(v({ cartonNo: 'C1', status: 'S', requestDate: '02/10/2026' }), false)?.message).toBe(
      'Invalid Date ! Date of Request must greater than Date of Send ',
    )
    expect(cartonProblem(v({ cartonNo: 'C1', status: 'S', sendDate: '05/10/2026', requestDate: '02/10/2026' }), false)?.field).toBe('requestDate')
    expect(cartonProblem(v({ cartonNo: 'C1', status: 'S', returnDate: '02/10/2026' }), false)?.message).toBe(
      'Invalid Date ! Date of Return must greater than Date of Delivery ',
    )
    expect(
      cartonProblem(v({ cartonNo: 'C1', status: 'S', deliveryDate: '01/10/2026', returnDate: '05/10/2026', destroyDate: '03/10/2026' }), false)?.message,
    ).toBe('Invalid Date ! Date of Destroy must greater than Date of Return ')
    expect(cartonProblem(v({ cartonNo: 'C1', status: 'R' }), false)?.message).toBe("Date Return cannot be null when the status is 'R' !")
    expect(cartonProblem(v({ cartonNo: 'C1', status: 'R', deliveryDate: '01/10/2026', returnDate: '02/10/2026' }), false)).toBeNull()
  })

  it('fills the form from a carton and builds the request for one or more cartons', () => {
    const row = {
      cartonNo: 'C1',
      status: 'S',
      sendDate: '2026-10-01T00:00:00',
      requestDate: null,
      deliveryDate: null,
      returnDate: null,
      destroyDate: null,
      remarks: 'r',
    } as CartonRow
    expect(cartonFromRow(row)).toMatchObject({ cartonNo: 'C1', status: 'S', sendDate: '01/10/2026', requestDate: '', remarks: 'r' })
    expect(cartonSaveRequest(['C1', 'C2'], v({ status: 'M', sendDate: '01/10/2026', remarks: ' x ' }), true)).toEqual({
      cartons: ['C1', 'C2'],
      status: 'M',
      sendDate: '2026-10-01',
      requestDate: null,
      deliveryDate: null,
      returnDate: null,
      destroyDate: null,
      remarks: 'x',
      edit: true,
    })
  })
})
