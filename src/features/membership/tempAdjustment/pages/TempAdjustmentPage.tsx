import { api, errorMessage } from '../../../../api/client'
import { AdjustmentPage } from '../../adjustment/pages/AdjustmentPage'

/** Resolves to the API's refusal message, or null when the membership belongs to a temporary payor. */
async function temporaryOnly(membershipNo: string): Promise<string | null> {
  try {
    await api.get(`/api/membership/temp-adjustment/${encodeURIComponent(membershipNo)}`)
    return null
  } catch (error) {
    return errorMessage(error)
  }
}

/** Membership &gt; Temp MBM Adj (legacy FrmTempMBMAdj): the Adjustment screen for memberships of temporary payors only. */
export function TempAdjustmentPage() {
  return <AdjustmentPage title="Temporary Membership Adjustment" canOpen={temporaryOnly} />
}
