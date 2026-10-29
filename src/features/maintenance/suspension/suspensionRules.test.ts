import { describe, expect, it } from 'vitest'
import { categoryDeleteProblem, categoryProblem, categoryRequest, clean, detailDeleteProblem, detailProblem, detailRequest, emptyDetail, keyLabel, payorOfMember } from './suspensionRules'

describe('Suspension Category checks', () => {
  it('asks for the code and then the description', () => {
    expect(categoryProblem({ code: ' ', description: 'x' })).toEqual({ field: 'code', message: 'Please Enter Code' })
    expect(categoryProblem({ code: '03', description: ' ' })).toEqual({ field: 'description', message: 'Please Enter Description' })
    expect(categoryProblem({ code: '03', description: 'x' })).toBeNull()
  })

  it('checks a delete: a code first, then that the list was searched', () => {
    expect(categoryDeleteProblem('', 0)).toBe('Please Enter Category Code')
    expect(categoryDeleteProblem('01', 0)).toBe('Please search the record')
    expect(categoryDeleteProblem('01', 2)).toBeNull()
  })

  it('sends the code and description trimmed and upper-cased, as ChkStr did', () => {
    expect(categoryRequest({ code: ' 03 ', description: ' blocked ' })).toEqual({ code: '03', description: 'BLOCKED' })
    expect(clean(' ab ')).toBe('AB')
  })
})

describe('Suspension Details checks', () => {
  const ok = { selection: '01', key: 'ab123', description: 'late', payor: 'AB - A PAYOR' }

  it('asks in the desktop order: selection, number or code, description, payor', () => {
    expect(detailProblem(emptyDetail)?.message).toBe('Please Enter Selection')
    expect(detailProblem({ ...emptyDetail, selection: '01' })?.message).toBe('Please Enter Member Number/Agent Code')
    expect(detailProblem({ ...emptyDetail, selection: '01', key: 'x' })?.message).toBe('Please Enter Description')
    expect(detailProblem({ ...emptyDetail, selection: '01', key: 'x', description: 'd' })?.message).toBe('Please Enter Payor')
  })

  it('refuses a member number that does not start with the payor code, but not an agent code', () => {
    expect(detailProblem({ ...ok, payor: 'XL - OTHER' })).toEqual({ field: 'payor', message: 'Payor Code Not Match' })
    expect(detailProblem({ ...ok, payor: 'ab - A PAYOR' })).toBeNull()
    expect(detailProblem({ ...ok, selection: '02', payor: 'XL - OTHER' })).toBeNull()
  })

  it('checks a delete: a selection, a key, then that the list was searched', () => {
    expect(detailDeleteProblem({ selection: '', key: '' }, 0)).toBe('Please Enter Selection')
    expect(detailDeleteProblem({ selection: '01', key: '' }, 0)).toBe('Please Enter Member Number or Agent Code')
    expect(detailDeleteProblem({ selection: '01', key: 'x' }, 0)).toBe('Please search the record')
    expect(detailDeleteProblem({ selection: '01', key: 'x' }, 1)).toBeNull()
  })

  it('finds the payor a member number belongs to from its first two letters', () => {
    const payors = [
      { value: 'AB - A PAYOR', label: 'AB - A PAYOR' },
      { value: 'XL - OTHER', label: 'XL - OTHER' },
    ]
    expect(payorOfMember('xl0001*01', payors)).toBe('XL - OTHER')
    expect(payorOfMember('QQ1', payors)).toBeUndefined()
  })

  it('labels the key by the selection and sends it cleaned', () => {
    expect([keyLabel('01'), keyLabel('02')]).toEqual(['Member Number', 'Agent Code'])
    expect(detailRequest({ selection: '02', key: ' ag1 ', description: ' note ', payor: 'AB - A PAYOR' })).toEqual({ selection: '02', key: 'AG1', description: 'NOTE', payor: 'AB - A PAYOR' })
  })
})
