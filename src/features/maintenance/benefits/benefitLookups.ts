import { useQuery } from '@tanstack/react-query'
import { benefitsApi } from './api/benefitsApi'

export interface Option {
  code: string
  name: string | null
}

export interface BenefitLookups {
  healthTypes: Option[]
  insuredTypes: Option[]
  categories: Option[]
  subCategories: Option[]
  payors: Option[]
  groupCompanies: string[]
}

export const lookupsKey = ['benefit-lookups']

/** Drop-down lists for the Benefits Maintenance tabs. Refreshed after a category or sub category is saved or deleted. */
export function useBenefitLookups() {
  return useQuery({
    queryKey: lookupsKey,
    queryFn: () => benefitsApi.getLookups<BenefitLookups>(),
    staleTime: 5 * 60_000,
  })
}

export const optionLabel = (o: Option) => (o.name ? `${o.code} - ${o.name}` : o.code)

/** Days, RM / day and RM per disability as typed (RM per disability can be text such as FULL). */
export interface AmountsForm {
  days: string
  ratePerDay: string
  perDisability: string
}

export const emptyAmounts: AmountsForm = { days: '', ratePerDay: '', perDisability: '' }

export const amountsBody = (a: AmountsForm) => ({
  days: a.days.trim() === '' ? null : Number(a.days),
  ratePerDay: a.ratePerDay.trim() || null,
  perDisability: a.perDisability.trim() || null,
})

/** Like the desktop grid: when days and RM / day are both numbers, RM per disability becomes their product. */
export function withProduct(a: AmountsForm): AmountsForm {
  const days = Number(a.days)
  const rate = Number(a.ratePerDay)
  if (a.days.trim() === '' || a.ratePerDay.trim() === '' || Number.isNaN(days) || Number.isNaN(rate)) return a
  return { ...a, perDisability: String(Math.round(days * rate * 100) / 100) }
}
