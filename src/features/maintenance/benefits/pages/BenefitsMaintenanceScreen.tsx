import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BenefitCategoryTab, BenefitSubCategoryTab } from '../components/BenefitCategoryTabs'
import { BenefitEntryTab } from '../components/BenefitEntryTab'
import { BenefitListingTab } from '../components/BenefitListingTab'

const tabs: { id: string; label: string; body: () => ReactNode }[] = [
  { id: 'category', label: 'Category', body: () => <BenefitCategoryTab /> },
  { id: 'sub-category', label: 'Sub Category', body: () => <BenefitSubCategoryTab /> },
  { id: 'entry', label: 'Benefit Entry', body: () => <BenefitEntryTab /> },
  { id: 'listing', label: 'Benefits Listing', body: () => <BenefitListingTab /> },
]

/** Maintenance > Benefits (legacy frmMaintenanceBenefits). */
export function BenefitsMaintenanceScreen() {
  const [params, setParams] = useSearchParams()
  const current = tabs.find((t) => t.id === params.get('tab')) ?? tabs[0]

  return (
    <section>
      <h2>Benefits Maintenance</h2>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            className={t.id === current.id ? 'active' : undefined}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body" key={current.id}>
        {current.body()}
      </div>
    </section>
  )
}
