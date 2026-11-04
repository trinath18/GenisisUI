import { describe, expect, it } from 'vitest'
import {
  contraColumns,
  doneMessage,
  searchDefaults,
  searchParams,
  scanProblem,
  searchSchema,
  tickProblem,
  tickableKeys,
  updateProblem,
} from './contraAllocationRules'
import type { ContraRow } from './contraAllocationRules'

const row = (over: Partial<ContraRow> = {}): ContraRow => ({
  id: 1,
  refNo: 'R1',
  caseNo: 'MA00003',
  versionNo: '1',
  caseAmt: 125,
  contraCaseNo: 'MA00005',
  contraVersionNo: '2',
  contraCaseAmt: 1200.5,
  allocationNo: null,
  allocationDate: null,
  contraStatus: null,
  ...over,
})

describe('Contra Allocation', () => {
  it('shows a row the way the desktop listed it', () => {
    expect(contraColumns.map((c) => c.label)).toEqual([
      'Contra Status',
      'Claim No',
      'Claim Amount',
      'Contra Claim No',
      'Contra Claim Amount',
      'Allocation No',
      'Allocation Date',
    ])
    expect(contraColumns.map((c) => c.value(row({ allocationNo: '100003', allocationDate: '2003-03-05T00:00:00', contraStatus: 'A' })))).toEqual([
      'ALLOCATED',
      'MA00003-1',
      '125.00',
      'MA00005-2',
      '1,200.50',
      '100003',
      '05/03/2003',
    ])
    expect(contraColumns.map((c) => c.value(row({ caseNo: null, versionNo: null, caseAmt: null, contraCaseNo: null, contraCaseAmt: null })))).toEqual([
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ])
  })

  it('refuses to tick a row that is allocated or has no claim', () => {
    expect(tickProblem(row())).toBeNull()
    expect(tickProblem(row({ contraStatus: 'A' }))).toBe('Record has been allocated!')
    expect(tickProblem(row({ caseNo: ' ' }))).toBe('The record has no claim to allocate.')
    expect([...tickableKeys([row({ id: 1 }), row({ id: 2, contraStatus: 'A' }), row({ id: 3, caseNo: null }), row({ id: 4 })])]).toEqual(['1', '4'])
  })

  it('asks for a row to be ticked and says the number', () => {
    expect(updateProblem([])).toBe('Please select the record')
    expect(updateProblem([row()])).toBeNull()
    expect(doneMessage('100007')).toBe('Record Updated, Your Allocation Number is : 100007')
  })

  it('searches a range, or in Use Scan one claim that is not in the list yet', () => {
    expect(searchParams({ ...searchDefaults, status: '2', caseFrom: ' MA1 ', caseTo: 'MA9', dateFrom: '05/03/2003' })).toMatchObject({
      status: 2,
      caseFrom: 'MA1',
      caseTo: 'MA9',
      scanCase: undefined,
      dateFrom: '2003-03-05',
    })
    expect(searchParams({ ...searchDefaults, scan: true, caseFrom: 'MA1', caseTo: 'MA9' })).toMatchObject({
      scanCase: 'MA1',
      caseFrom: undefined,
      caseTo: undefined,
    })
    expect(scanProblem({ ...searchDefaults, scan: true }, [])).toBe('Please Enter Case No')
    expect(scanProblem({ ...searchDefaults, scan: true, caseFrom: 'ma00003' }, [row()])).toBe('Data has been uploaded!')
    expect(scanProblem({ ...searchDefaults, scan: true, caseFrom: 'MA00004' }, [row()])).toBeNull()
    expect(scanProblem({ ...searchDefaults, caseFrom: 'MA00003' }, [row()])).toBeNull()
  })

  it('checks the box lengths and the dates', async () => {
    await expect(searchSchema.validate({ ...searchDefaults, refFrom: 'x'.repeat(16) })).rejects.toThrow('Ref No is too long')
    await expect(searchSchema.validate({ ...searchDefaults, dateFrom: '31/02/2021' })).rejects.toThrow('Invalid Date Format!')
    await expect(searchSchema.validate(searchDefaults)).resolves.toBeTruthy()
  })
})
