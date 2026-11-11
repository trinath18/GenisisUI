import { describe, expect, it } from 'vitest'
import {
  caseDisabled,
  codeOptions,
  defaults,
  disabledFor,
  figure,
  fileRows,
  options,
  payorOptions,
  reportName,
  requestOf,
  selectionsFor,
  typesFor,
  withoutCaseCriteria,
} from './dcuReportRules'
import type { ReportType, Values } from './dcuReportRules'

const types: ReportType[] = [
  { index: 0, name: 'General Listing', claim: ['Without Remarks'], case: ['Without Remarks'] },
  {
    index: 1,
    name: 'Age Band',
    claim: ['Summary', 'By Gender', 'By Insured Type', 'By Race', 'By Plan No', 'By Bordx Month'],
    case: ['Summary', 'By Gender', 'By Insured Type', 'By Race', 'By Plan No'],
  },
  { index: 6, name: 'Payor', claim: [], case: [] },
  { index: 9, name: 'Efficiency', claim: ['Registration', 'Bordereaux (Claim)', 'Invoice', 'Bordereaux (Inv.)', 'O/S Bordereaux'], case: null },
]
const v = (over: Partial<Values> = {}): Values => ({ ...defaults, ...over })

describe('the report chosen', () => {
  it('offers Efficiency for a Claim report only and the selections of the type for the mode', () => {
    expect(typesFor(types, 'claim').map((t) => t.name)).toEqual(['General Listing', 'Age Band', 'Payor', 'Efficiency'])
    expect(typesFor(types, 'case').map((t) => t.name)).toEqual(['General Listing', 'Age Band', 'Payor'])
    expect(selectionsFor(types, 'claim', 1)).toHaveLength(6)
    expect(selectionsFor(types, 'case', 1)).toHaveLength(5)
    expect(selectionsFor(types, 'claim', 6)).toEqual([])
    expect(selectionsFor(types, 'case', 9)).toEqual([])
    expect(options(['A', 'B'])).toEqual([
      { value: '0', label: 'A' },
      { value: '1', label: 'B' },
    ])
  })

  it('names it as Claim - type - selection', () => {
    expect(reportName(types, v({ reportType: '1', selection: '1' }))).toBe('Claim - Age Band - By Gender')
    expect(reportName(types, v({ mode: 'case', reportType: '6', selection: '' }))).toBe('Case - Payor')
  })
})

describe('the criteria', () => {
  it('starts as the desktop did: a Claim report of the general listing, Case Status Open & Close', () => {
    expect([defaults.mode, defaults.reportType, defaults.selection, defaults.caseStatus, defaults.memberType, defaults.supplementaryType]).toEqual([
      'claim',
      '0',
      '0',
      '1',
      '',
      '',
    ])
  })

  it('has no bordx or version criteria in a Case report', () => {
    expect(caseDisabled).toEqual(['bordxNoFrom', 'bordxNoTo', 'blankBordxNo', 'bordxDateFrom', 'bordxDateTo', 'blankBordxDate', 'versionFrom', 'versionTo'])
    expect(disabledFor('case', 'versionFrom')).toBe(true)
    expect(disabledFor('claim', 'versionFrom')).toBe(false)
    expect(disabledFor('case', 'payor')).toBe(false)
    const cleared = withoutCaseCriteria(v({ bordxNoFrom: 'B1', blankBordxNo: true, bordxDateFrom: '01/01/2021', versionTo: '3', payor: 'AC - X' }))
    expect([cleared.bordxNoFrom, cleared.blankBordxNo, cleared.bordxDateFrom, cleared.versionTo, cleared.payor]).toEqual(['', false, '', '', 'AC - X'])
  })

  it('sends the codes of the boxes, ISO dates, numbers and only what was filled in', () => {
    const request = requestOf(
      v({
        reportType: '1',
        selection: '2',
        payor: 'AC - ALLIANZ',
        insType: 'I - Individual',
        policyStatus: 'A - Active',
        healthType: 'N',
        doaFrom: '01/02/2021',
        versionFrom: '2',
        agentCode: ' x ',
        blankPlan: true,
        bordxNoFrom: 'NAC1',
        bordxDateTo: '31/03/2021',
      }),
    )
    expect(request).toMatchObject({
      mode: 'claim',
      reportType: 1,
      selection: 2,
      payor: 'AC',
      insType: 'I',
      policyStatus: 'A',
      healthType: 'N',
      doaFrom: '2021-02-01',
      versionFrom: 2,
      agentCode: 'x',
      blankPlan: true,
      bordxNoFrom: 'NAC1',
      bordxDateTo: '2021-03-31',
      caseStatus: 1,
    })
    expect(request.dodFrom).toBeUndefined()
    expect(request.memberType).toBeUndefined()
    expect(requestOf(v({ mode: 'case', bordxNoFrom: 'NAC1', versionFrom: '2', blankBordxDate: true, payor: 'AC' }))).toMatchObject({
      mode: 'case',
      payor: 'AC',
      bordxNoFrom: undefined,
      versionFrom: undefined,
      blankBordxDate: false,
    })
    expect(requestOf(v({ reportType: '6', selection: '' })).selection).toBeUndefined()
    expect(requestOf(v({ memberType: 'P', supplementaryType: 'S' }))).toMatchObject({ memberType: 'P', supplementaryType: 'S' })
  })

  it('offers the payors of the health type chosen and every code with its name', () => {
    const payors = [
      { code: 'AC', name: 'ALLIANZ', healthType: 'N' },
      { code: 'ST', name: 'TAKAFUL', healthType: 'S' },
      { code: 'XX', name: 'NONE', healthType: null },
    ]
    expect(payorOptions(payors, '').map((o) => o.value)).toEqual(['AC - ALLIANZ', 'ST - TAKAFUL', 'XX - NONE'])
    expect(payorOptions(payors, 'S').map((o) => o.value)).toEqual(['ST - TAKAFUL'])
    expect(codeOptions([{ code: 'I', name: 'Individual' }])).toEqual([{ value: 'I', label: 'I - Individual' }])
  })
})

describe('the list', () => {
  it('reads a figure of a cell, a bracketed one as negative and text as not a number', () => {
    expect([figure('1,234.50'), figure('(3.00)'), figure('12'), figure('')]).toEqual([1234.5, -3, 12, Number.NaN])
    expect(Number.isNaN(figure('January'))).toBe(true)
  })

  it('writes the file with the headings of the list', () => {
    expect(
      fileRows({
        title: 't',
        columns: [
          { header: 'Payor', right: false },
          { header: 'Total', right: true },
        ],
        rows: [['AC', '5']],
        truncated: false,
      }),
    ).toEqual([
      ['Payor', 'Total'],
      ['AC', '5'],
    ])
  })
})
