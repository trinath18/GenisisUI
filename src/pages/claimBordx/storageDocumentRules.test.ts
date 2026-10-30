import { describe, expect, it } from 'vitest'
import {
  addProblem,
  docTypeOptions,
  documentTickProblem,
  saveRequest,
  searchDefaults,
  searchParams,
  storeDefaults,
  storeFromRow,
  storeProblem,
} from './storageDocumentRules'
import type { DocumentRow, DocumentStoreValues } from './storageDocumentRules'

const full: DocumentStoreValues = { ...storeDefaults, docType: 'B', carton: 'C1', fileStatus: 'I' }

describe('Storage Document checks', () => {
  it('asks in the desktop order: type, carton, file status', () => {
    expect(storeProblem(storeDefaults)?.message).toBe('Please Enter Document Type')
    expect(storeProblem({ ...storeDefaults, docType: 'B' })?.message).toBe('Please Enter Carton Number')
    expect(storeProblem({ ...storeDefaults, docType: 'B', carton: 'C1' })?.message).toBe('Please Enter File Status')
    expect(storeProblem(full)).toBeNull()
  })

  it('checks the dates only when somebody requested the document', () => {
    const asked = { ...full, requestBy: 'USER1' }
    expect(storeProblem(asked)).toEqual({ field: 'requestDate', message: 'Please Enter Date Of Request' })
    expect(storeProblem({ ...asked, requestDate: '10/05/2021', deliveryDate: '09/05/2021' })?.message).toBe(
      'Invalid Date ! Date of Delivery must greater than Date of Request',
    )
    expect(storeProblem({ ...asked, requestDate: '10/05/2021', deliveryDate: '10/05/2021', returnDate: '09/05/2021' })?.message).toBe(
      'Invalid Date ! Date of Return must greater than Date of Delivery',
    )
    expect(storeProblem({ ...asked, requestDate: '10/05/2021', returnDate: '12/05/2021' })?.message).toBe(
      'Invalid Date ! Date of Return must greater than Date of Delivery',
    )
    expect(storeProblem({ ...asked, requestDate: '10/05/2021', deliveryDate: '11/05/2021', returnDate: '11/05/2021' })).toBeNull()
    expect(storeProblem({ ...full, deliveryDate: '01/01/2000' })).toBeNull()
  })

  it('needs one ticked document to add and refuses to tick one that is stored', () => {
    expect(addProblem(0)).toBe('Please checked at least 1 Claim !')
    expect(addProblem(2)).toBeNull()
    expect(documentTickProblem({ docType: 'P' } as DocumentRow)).toBe('Claim has been stored!')
    expect(documentTickProblem({ docType: null } as DocumentRow)).toBeNull()
  })

  it('offers the desktop document types and starts a search on bordx for all file statuses', () => {
    expect(docTypeOptions.map((o) => o.label)).toEqual(['B - Bordx', 'P - Payment Voucher', 'R - Receipt'])
    expect([searchDefaults.docType, searchDefaults.fileStatus]).toEqual(['B', 'A'])
  })
})

describe('Storage Document requests', () => {
  it('leaves "All" and blanks out of the search and sends the dates as ISO days', () => {
    expect(searchParams({ ...searchDefaults, docFrom: ' 100 ', requestDate: '01/04/2021' })).toEqual({
      docType: 'B',
      docFrom: '100',
      docTo: undefined,
      carton: undefined,
      fileStatus: undefined,
      requestBy: undefined,
      requestDate: '2021-04-01',
      deliveryDate: undefined,
      returnDate: undefined,
    })
    expect(searchParams({ ...searchDefaults, fileStatus: 'O' }).fileStatus).toBe('O')
  })

  it('fills the storage form from a stored row and builds the save request', () => {
    const row: DocumentRow = {
      documentNo: 'CA1',
      cartonNo: 'C9',
      docType: 'P',
      fileStatus: 'O',
      registerDate: '2007-10-22T00:00:00',
      requestBy: 'USER1',
      requestDate: '2007-10-23T00:00:00',
      deliveryDate: null,
      returnDate: null,
      remarks: 'box',
      department: 'ACCOUNT',
    }
    const values = storeFromRow(row)
    expect(values).toMatchObject({ docType: 'P', carton: 'C9', fileStatus: 'O', requestDate: '23/10/2007', deliveryDate: '', department: 'ACCOUNT' })
    expect(saveRequest(['CA1'], values, true)).toMatchObject({
      documents: ['CA1'],
      docType: 'P',
      carton: 'C9',
      requestDate: '2007-10-23',
      deliveryDate: null,
      edit: true,
    })
  })
})
