// The desktop's hidden "scan code" shortcut (Medix.bas SearchForm): typing a code that starts with LO in the Wks No / Case No box of a
// search screen opens another screen instead of searching. A null route is a screen that has not been migrated yet.

interface ScanTarget {
  label: string
  route: string | null
}

const targets: Record<string, ScanTarget> = {
  LOM001: { label: 'Membership Registration', route: '/membership/registration' },
  LOM002: { label: 'Membership Adjustment', route: '/membership/adjustment' },
  LOM003: { label: 'Membership Enquiry', route: '/membership/enquiry' },
  LOM004: { label: 'Membership Tracking', route: null },
  LOC001: { label: 'Case Registration', route: '/case/registration' },
  LOC002: { label: 'Case Adjustment', route: '/case/adjustment' },
  LOC003: { label: 'Case Enquiry', route: '/case/enquiry' },
  LOC004: { label: 'Case Tracking', route: '/case/tracking' },
  LOW003: { label: 'Worksheet Tracking', route: '/worksheet/tracking' },
  LOB001: { label: 'Inpatient Case Listing', route: '/case/listing' },
  LOB002: { label: 'Remove Worksheet', route: null },
  LOB003: { label: 'Print Bordx', route: null },
  LOB004: { label: 'Bordx Tracking', route: null },
  LOB005: { label: 'Claim Tracking', route: null },
  LOB006: { label: 'Claim Tracking 2', route: null },
  LOB007: { label: 'Claim Tracking 3', route: null },
  LOB008: { label: 'Claim Tracking 4', route: null },
  LOB009: { label: 'Print Bordx Excess', route: null },
  LOP001: { label: 'Payment to Hospital', route: null },
  LOP002: { label: 'Payment to Member', route: null },
  LOR001: { label: 'Receipt from Member', route: null },
  LOR002: { label: 'Receipt from Payor', route: null },
  LOR003: { label: 'Receipt from MNRB', route: null },
  LOI001: { label: 'Invoice Entry', route: null },
  LOI002: { label: 'Invoice Tracking', route: null },
}

/** Mid(ScanCode, 1, 2) = "LO": the text is a scan code, not a worksheet number. */
export const isScanCode = (text: string) => text.trim().slice(0, 2).toUpperCase() === 'LO'

export type ScanOutcome = { kind: 'open'; route: string } | { kind: 'notMigrated'; label: string } | { kind: 'unknown'; code: string }

/** Where a scan code leads. The access check is the destination screen's own route guard. */
export function resolveScanCode(text: string): ScanOutcome {
  const code = text.trim().toUpperCase()
  const target = targets[code]
  if (!target) return { kind: 'unknown', code }
  return target.route ? { kind: 'open', route: target.route } : { kind: 'notMigrated', label: target.label }
}
