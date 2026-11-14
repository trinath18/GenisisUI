import { describe, expect, it } from 'vitest'
import { emptyValues, listColumns, rowProblem, rowRequest, searchProblem, valuesOf } from './surgicalScheduleRules'

describe('Surgical Schedule checks', () => {
  it('needs a payor and then a plan to search', () => {
    expect(searchProblem({ payor: '', plan: '' })?.message).toBe('Please Select Payor!')
    expect(searchProblem({ payor: 'AX', plan: ' ' })?.message).toBe('Please Enter Plan Code!')
    expect(searchProblem({ payor: 'AX', plan: 'A1' })).toBeNull()
  })

  it('needs a main category that fits and a whole percentage from 0 to 100', () => {
    expect(rowProblem(emptyValues)?.message).toBe('Please Enter Surgical Main Category!')
    expect(rowProblem({ ...emptyValues, mainCategory: 'X'.repeat(51) })?.message).toBe('Surgical Main Category can have at most 50 characters.')
    expect(rowProblem({ mainCategory: 'M', subCategory: 'X'.repeat(201), percentage: '1' })?.message).toBe('Surgical Sub Category can have at most 200 characters.')
    expect(rowProblem({ ...emptyValues, mainCategory: 'M' })?.message).toBe('Please Enter Percentage!')
    expect(rowProblem({ ...emptyValues, mainCategory: 'M', percentage: '101' })?.message).toBe('Percentage must be from 0 to 100.')
    expect(rowProblem({ ...emptyValues, mainCategory: 'M', percentage: '12.5' })?.message).toBe('Percentage must be from 0 to 100.')
    expect(rowProblem({ ...emptyValues, mainCategory: 'M', percentage: '0' })).toBeNull()
  })
})

describe('Surgical Schedule request and list', () => {
  it('sends the upper-case key, the trimmed categories and the number', () => {
    expect(rowRequest({ payor: ' ax ', plan: ' a1 ' }, { mainCategory: ' MAJOR ', subCategory: '  ', percentage: '80' })).toEqual({
      payor: 'AX',
      plan: 'A1',
      mainCategory: 'MAJOR',
      subCategory: null,
      percentage: 80,
    })
  })

  it('fills the form from a row and lists the percentage with its sign', () => {
    const row = { index: 3, mainCategory: 'MAJOR', subCategory: null, percentage: 80 }
    expect(valuesOf(row)).toEqual({ mainCategory: 'MAJOR', subCategory: '', percentage: '80' })
    expect(listColumns.map((c) => c.value(row))).toEqual(['MAJOR', '', '80%'])
  })
})
