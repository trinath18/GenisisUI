// Pure rules of the guarantee letter dialog (frmGLMenu), shared by Case Adjustment and Worksheet Adjustment's Final LG.

/** The answer to the check made before a letter is issued. Final LG also asks the take-over question and warns instead of stopping. */
export interface GlCheck {
  withinLimit: boolean
  balance?: string
  takeOverCheck?: boolean
  prompt?: string
}

/** The addresses the dialog talks to: Case Adjustment's by default, Worksheet Adjustment's Final LG when given. */
export interface GlEndpoints {
  options: string
  defaults: string
  check: string
  issue: string
}

export const caseEndpoints = (cas: string): GlEndpoints => {
  const base = `/api/case/adjustment/${encodeURIComponent(cas)}`
  return { options: '/api/case/adjustment/gl-options', defaults: `${base}/gl`, check: `${base}/gl/check`, issue: `${base}/gl` }
}

/** Final LG asks the take-over clause question first when the server says so. */
export const needsTakeOver = (final: boolean, check: GlCheck) => final && check.takeOverCheck === true

/**
 * What the dialog does with the check: Case Adjustment stops when the amount is not within the limit; Final LG, like the desktop's worksheet form, lets the user go on past
 * the warning, so it asks the server's question. Everything else asks "Are you sure?".
 */
export function glDecision(final: boolean, check: GlCheck): { stop: string } | { ask: string } {
  if (final) return { ask: check.prompt ?? 'Are you sure?' }
  return check.withinLimit ? { ask: 'Are you sure?' } : { stop: 'Please check LG Amount' }
}
