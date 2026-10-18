import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { Option } from '../../components/Field'
import { payorCode } from './worksheetRules'

const none: Option[] = []
const TEN_MINUTES = 10 * 60 * 1000

/**
 * Drop-down data of the worksheet screens: payors ("PAYCode - PAYCompanyName"), insured types ("INSCode - INSDescription") and, once a
 * payor is chosen, the group companies that have worksheets for it. A failed request leaves the combo as a plain text box.
 */
export function useWorksheetLookups(payor = '', need: { insuredTypes?: boolean; groupCompanies?: boolean } = {}) {
  const payors = useQuery({
    queryKey: ['worksheet', 'payors'],
    queryFn: async () =>
      (await api.get<{ code: string; name: string | null }[]>('/api/worksheet/lookups/payors')).data.map((p) => {
        const text = p.name ? `${p.code} - ${p.name}` : p.code
        return { value: text, label: text }
      }),
    staleTime: TEN_MINUTES,
  })
  const insuredTypes = useQuery({
    queryKey: ['worksheet', 'insured-types'],
    queryFn: async () =>
      (await api.get<{ code: string; name: string | null }[]>('/api/worksheet/lookups/insured-types')).data.map((t) => ({
        value: t.code,
        label: t.name ? `${t.code} - ${t.name}` : t.code,
      })),
    enabled: !!need.insuredTypes,
    staleTime: TEN_MINUTES,
  })
  const code = payorCode(payor)
  const known = (payors.data ?? none).some((p) => payorCode(p.value) === code)
  const groupCompanies = useQuery({
    queryKey: ['worksheet', 'group-companies', code],
    queryFn: async () =>
      (await api.get<string[]>('/api/worksheet/tracking/group-companies', { params: { payor: code } })).data.map((g) => ({ value: g, label: g })),
    enabled: !!need.groupCompanies && known,
    staleTime: TEN_MINUTES,
  })
  return { payors: payors.data ?? none, insuredTypes: insuredTypes.data ?? none, groupCompanies: known ? (groupCompanies.data ?? none) : none }
}
