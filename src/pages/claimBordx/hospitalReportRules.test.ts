import { describe, expect, it } from 'vitest'
import { hospitalColumns, hospitalDefaults, hospitalParams, printProblem, rangeProblem, reportRows } from './hospitalReportRules'
import type { HospitalValues } from './hospitalReportRules'
import type { PrintRow } from './printBordxRules'

const v = (over: Partial<HospitalValues> = {}): HospitalValues => ({ ...hospitalDefaults, ...over })

describe('Hospital Report criteria', () => {
  it('needs both ends of the bordx range, then a bordx chosen in the list to print', () => {
    expect(rangeProblem(v())).toEqual({ field: 'bordxFrom', message: 'Please enter Bordx Reference No' })
    expect(rangeProblem(v({ bordxFrom: 'B1' }))).toEqual({ field: 'bordxTo', message: 'Please enter Bordx Reference No' })
    expect(rangeProblem(v({ bordxFrom: 'B1', bordxTo: 'B2' }))).toBeNull()
    expect(printProblem(v(), 'B1')).toBe('Please enter Bordx Reference No')
    expect(printProblem(v({ bordxFrom: 'B1', bordxTo: 'B2' }), null)).toBe('Please Select Bordx')
    expect(printProblem(v({ bordxFrom: 'B1', bordxTo: 'B2' }), 'B1')).toBeNull()
  })

  it('sends the criteria, dates as ISO days', () => {
    expect(hospitalParams(v({ bordxFrom: ' B1 ', bordxTo: 'B2', hospital: ' H1 ', bordxDateFrom: '01/09/2026', dodTo: '30/09/2026' }))).toEqual({
      bordxFrom: 'B1',
      bordxTo: 'B2',
      hospital: 'H1',
      bordxDateFrom: '2026-09-01',
      bordxDateTo: undefined,
      doaFrom: undefined,
      doaTo: undefined,
      dodFrom: undefined,
      dodTo: '2026-09-30',
    })
  })
})

describe('Hospital Report files', () => {
  it('lists Print Bordx columns with the bordx date and writes each section with its title, headings and a blank line', () => {
    expect(hospitalColumns.at(-1)!.label).toBe('BordxDate')
    expect(hospitalColumns.at(-1)!.value({ bordxDate: '2026-10-01T00:00:00' } as PrintRow)).toBe('01/10/2026')
    expect(
      reportRows({
        name: 'NMH1',
        date: '2026-10-01T00:00:00',
        sections: [
          {
            title: 'Payment Advice - Panel Hospitals',
            header: ['No', 'Hospital'],
            rows: [
              ['001', 'H1'],
              ['', 'Total'],
            ],
          },
          { title: 'Recovery', header: ['Name'], rows: [['A']] },
        ],
      }),
    ).toEqual([['Payment Advice - Panel Hospitals'], ['No', 'Hospital'], ['001', 'H1'], ['', 'Total'], [], ['Recovery'], ['Name'], ['A'], []])
  })
})
