// Claim Bordx > Payment Advice > Hospital Report (legacy frmPayAdviceHosRpt, "Payment Advice- By Hospital"): the criteria, the checks, the queries and the file the report is written to (the desktop filled Excel and
// Word templates). The sets of the report are made on the server.

import * as yup from 'yup'
import type { CsvColumn } from '../../lib/exportCsv'
import { dmyDate, optionalText } from '../../lib/validation'
import { isoDmy, isoToDmy } from '../case/caseShared'
import { printColumns } from './printBordxRules'
import type { PrintRow } from './printBordxRules'

export interface ReportSection {
  title: string
  header: string[]
  rows: string[][]
}

export interface ReportDocument {
  name: string
  date: string
  sections: ReportSection[]
}

export interface HospitalSearchResult {
  rows: PrintRow[]
  totalAmount: number
  truncated: boolean
}

export interface HospitalValues {
  bordxFrom: string
  bordxTo: string
  hospital: string
  bordxDateFrom: string
  bordxDateTo: string
  doaFrom: string
  doaTo: string
  dodFrom: string
  dodTo: string
}

export const hospitalDefaults: HospitalValues = {
  bordxFrom: '',
  bordxTo: '',
  hospital: '',
  bordxDateFrom: '',
  bordxDateTo: '',
  doaFrom: '',
  doaTo: '',
  dodFrom: '',
  dodTo: '',
}

export const hospitalSchema = yup.object({
  bordxFrom: optionalText(),
  bordxTo: optionalText(),
  hospital: optionalText(),
  bordxDateFrom: dmyDate(),
  bordxDateTo: dmyDate(),
  doaFrom: dmyDate(),
  doaTo: dmyDate(),
  dodFrom: dmyDate(),
  dodTo: dmyDate(),
}) as yup.ObjectSchema<HospitalValues>

/** CmdSearch_Click / CmdPrintSummary_Click's check: both ends of the bordx range. */
export const rangeProblem = (v: HospitalValues) =>
  v.bordxFrom.trim() === '' || v.bordxTo.trim() === ''
    ? { field: (v.bordxFrom.trim() === '' ? 'bordxFrom' : 'bordxTo') as 'bordxFrom' | 'bordxTo', message: 'Please enter Bordx Reference No' }
    : null

/** CmdPrintSummary_Click then GeneratePaymentSum: the range, then a bordx chosen in the list. */
export const printProblem = (v: HospitalValues, selected: string | null) =>
  rangeProblem(v) ? rangeProblem(v)!.message : selected ? null : 'Please Select Bordx'

const text = (v: string) => v.trim() || undefined
const day = (v: string) => isoDmy(v) ?? undefined

/** The query of the search and of the CC Report. */
export const hospitalParams = (v: HospitalValues) => ({
  bordxFrom: text(v.bordxFrom),
  bordxTo: text(v.bordxTo),
  hospital: text(v.hospital),
  bordxDateFrom: day(v.bordxDateFrom),
  bordxDateTo: day(v.bordxDateTo),
  doaFrom: day(v.doaFrom),
  doaTo: day(v.doaTo),
  dodFrom: day(v.dodFrom),
  dodTo: day(v.dodTo),
})

/** The columns of the list: Print Bordx's, with the bordx date at the end. */
export const hospitalColumns: CsvColumn<PrintRow>[] = [...printColumns, { label: 'BordxDate', value: (r) => isoToDmy(r.bordxDate) }]

/** The report as the lines of a CSV file: each section is its title, its headings, its lines and a blank line. */
export const reportRows = (doc: ReportDocument): string[][] => doc.sections.flatMap((s) => [[s.title], s.header, ...s.rows, []])
