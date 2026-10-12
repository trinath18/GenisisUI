import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlanMaintenancePage } from './PlanMaintenancePage'
import { PremiumPage } from './PremiumPage'
import { AnnualLimitPage } from './AnnualLimitPage'
import { CodeListTab } from './CodeListTab'
import { SpecialNoteTab } from './SpecialNoteTab'
import { BenefitLimitTab, MgmtFeeTab } from './PlanKeyedTabs'

const tabs: { id: string; label: string; body?: () => ReactNode }[] = [
  {
    id: 'health-type',
    label: 'Health Type',
    body: () => <CodeListTab list="health-types" codeLabel="Health Type" descriptionLabel="Health Description" codeLength={2} descriptionLength={100} />,
  },
  {
    id: 'insured-type',
    label: 'Insured Type',
    body: () => <CodeListTab list="insured-types" codeLabel="Insured Type" descriptionLabel="Insured Type Description" codeLength={2} descriptionLength={100} />,
  },
  { id: 'plan', label: 'Plan Code', body: () => <PlanMaintenancePage /> },
  { id: 'premium', label: 'Premium', body: () => <PremiumPage /> },
  { id: 'annual-limit', label: 'Annual Limit', body: () => <AnnualLimitPage /> },
  { id: 'mco-fee', label: 'MCO Fee' },
  { id: 'special-note', label: 'Special Note', body: () => <SpecialNoteTab /> },
  { id: 'annual-limit-benefit', label: 'Annual Limit (Benefit)', body: () => <BenefitLimitTab /> },
  {
    id: 'product-category',
    label: 'Product Category',
    body: () => <CodeListTab list="product-categories" codeLabel="Product Code" descriptionLabel="Product Name" codeLength={2} descriptionLength={50} />,
  },
  {
    id: 'supp-mco-status',
    label: 'Supp. MCO Status',
    body: () => <CodeListTab list="supp-mco-statuses" codeLabel="MCO Code" descriptionLabel="MCO Status" codeLength={1} descriptionLength={200} />,
  },
  { id: 'case-mgmt-fee', label: 'Case Mgmt. Fee', body: () => <MgmtFeeTab /> },
]

export function PlanMaintenanceScreen() {
  const [params, setParams] = useSearchParams()
  const current = tabs.find((t) => t.id === params.get('tab') && t.body) ?? tabs.find((t) => t.id === 'plan')!

  return (
    <section>
      <h2>Plan Maintenance</h2>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            className={t.id === current.id ? 'active' : undefined}
            disabled={!t.body}
            title={t.body ? undefined : 'Not migrated yet'}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body" key={current.id}>
        {current.body!()}
      </div>
    </section>
  )
}
