/** MaskEdBox "##/##/####" — dd/mm/yyyy text kept in the desktop's format. */
export const maskDate = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/')
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
