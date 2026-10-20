// Case > Claim ASCII (legacy mnuClaimAscii -> frmNewClaimAscii) and Case > Case ASCII (legacy CaseASCII -> frmCaseASCII).

import { AsciiExportForm } from './AsciiExportForm'
import type { AsciiExportConfig } from './AsciiExportForm'

const exportStatuses = [
  { value: 'N', label: 'N - New' },
  { value: 'R', label: 'R - Reprint' },
]

const claimAscii: AsciiExportConfig = {
  endpoint: 'claim-ascii',
  title: 'Claim ASCII',
  subtitle: 'Generate the claim ASCII file for a payor.',
  serverFolder: 'ClaimASCI',
  variants: [
    { key: 'accepted', label: 'Accepted Cases', dateLabel: 'Bordx Date', showStatusFields: true },
    { key: 'rejected', label: 'Rejected Cases', dateLabel: 'Case Reg. Date', showStatusFields: false },
  ],
  exportStatuses,
  worksheetStatusLabel: 'Bordx WS',
  worksheetStatuses: [
    { value: '0', label: '0 - New & Amendment' },
    { value: '1', label: '1 - Deleted' },
  ],
}

const caseAscii: AsciiExportConfig = {
  endpoint: 'case-ascii',
  title: 'Case ASCII',
  subtitle: 'Generate the case ASCII file for a payor.',
  serverFolder: 'CaseASCII',
  variants: [{ key: 'cases', label: 'Cases', dateLabel: 'Case Reg. Date', showStatusFields: true }],
  exportStatuses,
  worksheetStatusLabel: 'Endt Status',
  worksheetStatuses: [
    { value: '0', label: '0 - New' },
    { value: '1', label: '1 - Deleted' },
    { value: '2', label: '2 - Amendment' },
  ],
  totalLabel: 'Total Cases',
}

export const ClaimAsciiPage = () => <AsciiExportForm config={claimAscii} />

export const CaseAsciiPage = () => <AsciiExportForm config={caseAscii} />
