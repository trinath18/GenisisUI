import type { CodeOption } from '../../../components/common/CodeSelect'

export interface TrackingReport {
  key: string
  typeIndex: number
  type: string
  selection: string
  kind: string
}

export type FieldKind = 'Select' | 'Text' | 'Number' | 'Date'

export interface TrackingField {
  key: string
  label: string
  group: string
  kind: FieldKind
  range: boolean
  blankable: boolean
  /** Only the "blank" box applies (no value). */
  blankOnly: boolean
  options: CodeOption[] | null
}

export interface TrackingMeta {
  reports: TrackingReport[]
  fields: TrackingField[]
  payorHealth: Record<string, string | null>
}

export type Cell = string | number | boolean | null

export interface TrackingTotals {
  principals: number
  supplementaries: number
  total: number
  mco: number
  premium: number
  accessFee: number
}

export interface TrackingResult {
  columns: string[]
  rows: Record<string, Cell>[]
  totals: TrackingTotals
  truncated: boolean
}

export interface RangeValue {
  from: string
  to: string
}

/** What the user chose on the screen (request body of run / export). */
export interface TrackingRequest {
  report: string
  memberType: string
  principalType: string
  values: Record<string, string>
  ranges: Record<string, RangeValue>
  blanks: string[]
}
