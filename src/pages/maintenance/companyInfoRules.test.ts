import { describe, expect, it } from 'vitest'
import { companyInfoDefaults, companyInfoFromRow, companyInfoProblem, companyInfoRequest, companyInfoSchema } from './companyInfoRules'

const full = { code: 'MX', name: 'MediExpress', address: '1 Jalan', phone: '03-1234.5678', fax: '', email: 'a@b.my', homepage: 'www.b.my', currentYear: '2026' }

describe('Company Info', () => {
  it('asks for the code, the name and the year, one at a time, in the desktops order', () => {
    expect(companyInfoProblem(companyInfoDefaults)?.message).toBe('Please Enter Company Code')
    expect(companyInfoProblem({ ...companyInfoDefaults, code: 'MX' })?.message).toBe('Please Enter Company Name')
    expect(companyInfoProblem({ ...companyInfoDefaults, code: 'MX', name: 'N' })?.message).toBe('Please Enter Company Current Year')
    expect(companyInfoProblem({ ...companyInfoDefaults, code: 'MX', name: 'N', currentYear: '  ' })?.field).toBe('currentYear')
    expect(companyInfoProblem(full)).toBeNull()
  })

  it('takes what the number boxes took and the box lengths', async () => {
    await expect(companyInfoSchema.validate(full)).resolves.toBeTruthy()
    await expect(companyInfoSchema.validate({ ...full, phone: '03 12' })).rejects.toThrow('Phone No must be a number.')
    await expect(companyInfoSchema.validate({ ...full, fax: 'x' })).rejects.toThrow('Fax No must be a number.')
    await expect(companyInfoSchema.validate({ ...full, currentYear: '20266' })).rejects.toThrow('four digits')
    await expect(companyInfoSchema.validate({ ...full, name: 'n'.repeat(151) })).rejects.toThrow('Company Name is too long.')
    await expect(companyInfoSchema.validate({ ...full, address: 'a'.repeat(201) })).rejects.toThrow('Address is too long.')
  })

  it('shows the saved row and sends every box trimmed', () => {
    expect(companyInfoFromRow({ tableExists: true, found: true, code: 'MX', name: null, address: null, phone: '1', fax: null, email: null, homepage: null, currentYear: '2026' })).toEqual({
      ...companyInfoDefaults,
      code: 'MX',
      phone: '1',
      currentYear: '2026',
    })
    expect(companyInfoRequest({ ...full, code: ' MX ', address: ' x ' })).toMatchObject({ code: 'MX', address: 'x' })
  })
})
