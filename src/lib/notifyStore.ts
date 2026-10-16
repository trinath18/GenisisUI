export type NoticeKind = 'info' | 'success' | 'warn' | 'error'

export interface Notice {
  id: number
  kind: NoticeKind
  text: string
}
export interface PendingConfirm {
  text: string
  resolve: (ok: boolean) => void
}
export interface NotifyState {
  notices: Notice[]
  pending: PendingConfirm | null
}

let state: NotifyState = { notices: [], pending: null }
let seq = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const subscribeNotify = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const notifySnapshot = () => state

export function dismissNotice(id: number) {
  state = { ...state, notices: state.notices.filter((n) => n.id !== id) }
  emit()
}

/** Toast notification (replaces the desktop's MsgBox pop-ups). */
export function notify(text: string, kind: NoticeKind = 'warn') {
  const id = seq++
  state = { ...state, notices: [...state.notices, { id, kind, text }] }
  emit()
  window.setTimeout(() => dismissNotice(id), kind === 'error' ? 9000 : 6000)
}

export const say = (messages: string[]) => messages.forEach((m) => notify(m))

/** Yes/No confirmation (replaces MsgBox vbYesNo). */
export function ask(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    state = { ...state, pending: { text, resolve } }
    emit()
  })
}

export function answerConfirm(ok: boolean) {
  state.pending?.resolve(ok)
  state = { ...state, pending: null }
  emit()
}
