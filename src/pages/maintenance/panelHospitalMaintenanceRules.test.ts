import { describe, expect, it } from 'vitest'
import { allTicked, changeCount, codeMessage, codeProblem, columnsFor, rowKey, updateRequest } from './panelHospitalMaintenanceRules'
import type { Hospital } from './panelHospitalMaintenanceRules'

const rows: Hospital[] = [
  { code: 'H1', name: 'One', tel: '1', fax: null },
  { code: 'H2', name: 'Two', tel: null, fax: '2' },
  { code: 'H3', name: 'Three', tel: null, fax: null },
]

describe('Panel Hospital Maintenance', () => {
  it('needs a hospital panel code', () => {
    expect(codeMessage).toBe('Please Select Hospital Panel Code!')
    expect(codeProblem('  ')).toBe(codeMessage)
    expect(codeProblem('AXA1')).toBeNull()
  })

  it('lists the panels hospitals with their addresses and the hospitals that can be added with their phone and fax', () => {
    expect(columnsFor('edit').map((c) => c.label)).toEqual(['Hos Code', 'Hospital Name', 'Tel No', 'Fax No', 'Address 1', 'Address 2', 'Address 3', 'State', 'Town'])
    expect(columnsFor('add').map((c) => c.label)).toEqual(['Hos Code', 'Hospital Name', 'Tel No', 'Fax No'])
    expect(columnsFor('add').map((c) => c.value(rows[1]))).toEqual(['H2', 'Two', '', '2'])
  })

  it('shows the panel with every hospital ticked and takes out the ones that are unticked', () => {
    const ticked = allTicked(rows)
    expect([...ticked]).toEqual(['H1', 'H2', 'H3'])
    expect(updateRequest('edit', ' AXA1 ', rows, ticked)).toEqual({ code: 'AXA1', add: [], remove: [] })
    expect(updateRequest('edit', 'AXA1', rows, new Set(['H2']))).toEqual({ code: 'AXA1', add: [], remove: ['H1', 'H3'] })
    expect(rows.map(rowKey)).toEqual(['H1', 'H2', 'H3'])
  })

  it('adds the hospitals that are ticked in the Add list', () => {
    const request = updateRequest('add', 'AXA1', rows, new Set(['H3']))
    expect(request).toEqual({ code: 'AXA1', add: ['H3'], remove: [] })
    expect(changeCount(request)).toBe(1)
    expect(changeCount(updateRequest('add', 'AXA1', rows, new Set()))).toBe(0)
  })
})
