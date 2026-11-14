// The messages the desktop's Member Enquiry (frmNewMBMEnquiry) pops up when it shows a member, in its order: GL not allowed, suspended, priority and VIP (insurer type F or H
// only), the plan's message prompt, then the plan's special note. The web page lists them above the member instead of one dialog after another.

import { formatDate } from '../../../lib/format'
import type { Row } from '../../../lib/format'

export interface MemberAlert {
  text: string
  critical: boolean
}

const str = (v: unknown) => (v == null ? '' : String(v).trim())

export function memberAlerts(principal: Row, plan: Row | null): MemberAlert[] {
  const alerts: MemberAlert[] = []
  if (str(principal.MBMGLIssuance) === 'N') alerts.push({ text: 'GL is NOT allowed for this member', critical: false })
  if (str(principal.MBMStatus) === 'S') {
    alerts.push({ text: `Membership has been suspended since ${principal.MBMSuspendDate ? formatDate(principal.MBMSuspendDate) : ''}.`.replace(' .', '.'), critical: true })
  }
  if (['F', 'H'].includes(str(principal.INSCode))) {
    if (str(principal.MBMFullCover) === 'Y') alerts.push({ text: 'Please give priority to this member!', critical: true })
    if (str(principal.MBMVIP) === 'Y') alerts.push({ text: 'Please give priority. This member is a VIP!', critical: true })
  }
  const prompt = str(plan?.MessagePromt)
  if (prompt && prompt !== 'None') alerts.push({ text: prompt, critical: false })
  const note = str(principal.PLNSpecialNote)
  if (note) alerts.push({ text: note, critical: false })
  return alerts
}

/** The desktop's Pre and Next start from the number in the box, or the member shown when the box is empty. */
export const adjacentFrom = (input: string, shown: string | null) => input.trim() || (shown ?? '').trim()
