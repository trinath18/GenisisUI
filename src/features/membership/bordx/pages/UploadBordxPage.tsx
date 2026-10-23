import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { errorMessage } from '../../../../api/client'
import { bordxApi, bordxKeys } from '../api/bordxApi'
import { AsciiExportTab } from '../components/AsciiExportTab'
import { BordxUploadTab } from '../components/BordxUploadTab'
import { LOOKUPS_STALE_MS } from '../constants'

const TABS = [
  { id: 'upload', label: 'Upload' },
  { id: 'ascii', label: 'Generate ASCII' },
] as const
type TabId = (typeof TABS)[number]['id']

/** Membership &gt; Upload Bordx (legacy FrmNewMBMEndt10). */
export function UploadBordxPage() {
  const [tab, setTab] = useState<TabId>('upload')
  const lookups = useQuery({ queryKey: bordxKeys.lookups, queryFn: bordxApi.getLookups, staleTime: LOOKUPS_STALE_MS })

  if (lookups.isLoading) return <p className="muted">Loading…</p>
  if (lookups.isError)
    return (
      <p className="error" role="alert">
        {errorMessage(lookups.error)}
      </p>
    )
  return (
    <section>
      <h2>Upload Bordx</h2>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-body" role="tabpanel">
        {tab === 'upload' ? <BordxUploadTab lookups={lookups.data!} /> : <AsciiExportTab lookups={lookups.data!} />}
      </div>
    </section>
  )
}
