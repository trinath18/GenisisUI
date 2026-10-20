/** MaskEdBox "##/##/####" — dd/mm/yyyy text kept in the desktop's format. */
export const maskDate = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/')
}

/** dd/mm/yyyy text -> Date, or null when it is not a real calendar date (VB6 IsDate on the masked box). */
export function parseDmy(s: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (!m) return null
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null
}

/** MaskEdBox "##:##". */
export const maskTime = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return [d.slice(0, 2), d.slice(2)].filter(Boolean).join(':')
}

/** KeyNumber parity: digits and a single decimal point only. */
export const digitsOnly = (v: string) => {
  const dot = v.indexOf('.')
  const out = v.replace(/[^\d.]/g, '')
  return dot === -1 ? out : out.slice(0, dot + 1) + out.slice(dot + 1).replace(/\./g, '')
}
