import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Option } from '../../components/Field'

export interface ScreenLookups {
  /** SearchPayor: "<PAYCode> - <PAYCompanyName>". */
  payors: Option[]
  /** PanelHospitals.HosPanelCode. */
  panelCodes: Option[]
  /** Claim versions offered by the worksheet listing (PayorComboListing: 1 to 20). */
  worksheetVersions: Option[]
}

const worksheetVersions: Option[] = Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
const none: Option[] = []

/**
 * Dropdown data for the case screens. Only the lists a screen asks for are requested, because each list has its own
 * access right; a failed request leaves the combo as a plain text box.
 */
export function useScreenLookups(need: { payors?: boolean; panelCodes?: boolean } = {}): ScreenLookups {
  const payors = useQuery({
    queryKey: ['case-payors'],
    queryFn: async () =>
      (await api.get<{ code: string; name: string | null }[]>('/api/case/payors')).data.map((p) => ({
        value: p.name ? `${p.code} - ${p.name}` : p.code,
        label: p.name ? `${p.code} - ${p.name}` : p.code,
      })),
    enabled: !!need.payors,
    staleTime: 10 * 60 * 1000,
  })
  const panelCodes = useQuery({
    queryKey: ['panel-codes'],
    queryFn: async () =>
      (await api.get<{ code: string; description: string | null }[]>('/api/case/panel-hospitals/codes')).data.map((c) => ({ value: c.code, label: c.code })),
    enabled: !!need.panelCodes,
    staleTime: 10 * 60 * 1000,
  })
  return { payors: payors.data ?? none, panelCodes: panelCodes.data ?? none, worksheetVersions }
}
