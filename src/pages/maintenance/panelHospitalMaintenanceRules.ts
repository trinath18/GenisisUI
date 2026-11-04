// Maintenance > Panel Hospital Maintenance (legacy FrmMaintenancePanelHos): the hospitals of a hospital panel code. Search / Edit list the panel's hospitals ticked (untick one to take it out), Add lists the
// hospitals that are not in the panel (tick one to put it in), Update saves. The server repeats the checks.

export type Mode = 'edit' | 'add'

export interface PanelCode {
  code: string
  description: string | null
}

export interface Hospital {
  code: string
  name: string | null
  tel: string | null
  fax: string | null
  add1?: string | null
  add2?: string | null
  add3?: string | null
  state?: string | null
  town?: string | null
}

export interface UpdateRequest {
  code: string
  add: string[]
  remove: string[]
}

export const codeMessage = 'Please Select Hospital Panel Code!'

/** The panel code a search, Add or Update needs: null when none is chosen. */
export const codeProblem = (code: string) => (code.trim() === '' ? codeMessage : null)

export const rowKey = (row: Hospital) => row.code

/** Edit lists the panel's hospitals with their addresses; Add lists the hospitals that can be added with their phone and fax. */
export const columnsFor = (mode: Mode): { key: string; label: string; value: (h: Hospital) => string }[] =>
  mode === 'edit'
    ? [
        { key: 'code', label: 'Hos Code', value: (h) => h.code },
        { key: 'name', label: 'Hospital Name', value: (h) => h.name ?? '' },
        { key: 'tel', label: 'Tel No', value: (h) => h.tel ?? '' },
        { key: 'fax', label: 'Fax No', value: (h) => h.fax ?? '' },
        { key: 'add1', label: 'Address 1', value: (h) => h.add1 ?? '' },
        { key: 'add2', label: 'Address 2', value: (h) => h.add2 ?? '' },
        { key: 'add3', label: 'Address 3', value: (h) => h.add3 ?? '' },
        { key: 'state', label: 'State', value: (h) => h.state ?? '' },
        { key: 'town', label: 'Town', value: (h) => h.town ?? '' },
      ]
    : [
        { key: 'code', label: 'Hos Code', value: (h) => h.code },
        { key: 'name', label: 'Hospital Name', value: (h) => h.name ?? '' },
        { key: 'tel', label: 'Tel No', value: (h) => h.tel ?? '' },
        { key: 'fax', label: 'Fax No', value: (h) => h.fax ?? '' },
      ]

/** What Update sends: in Add the ticked hospitals are added; in Edit the unticked ones are removed. */
export function updateRequest(mode: Mode, code: string, rows: Hospital[], checked: ReadonlySet<string>): UpdateRequest {
  const ticked = rows.filter((r) => checked.has(rowKey(r))).map(rowKey)
  const unticked = rows.filter((r) => !checked.has(rowKey(r))).map(rowKey)
  return { code: code.trim(), add: mode === 'add' ? ticked : [], remove: mode === 'edit' ? unticked : [] }
}

/** How many hospitals Update changes (the confirmation does not say; the desktop confirmed even when nothing changed). */
export const changeCount = (request: UpdateRequest) => request.add.length + request.remove.length

/** The Edit list as it is first shown: every hospital ticked ("Panel"). */
export const allTicked = (rows: Hospital[]): ReadonlySet<string> => new Set(rows.map(rowKey))
