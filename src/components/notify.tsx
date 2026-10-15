import { useSyncExternalStore } from 'react'
import { Modal } from './Modal'
import { answerConfirm, dismissNotice, notifySnapshot, subscribeNotify } from '../lib/notifyStore'

/** Mount once (AppLayout). Renders the toast stack and the pending confirmation modal. */
export function NotifyHost() {
  const s = useSyncExternalStore(subscribeNotify, notifySnapshot)
  return (
    <>
      <div className="toasts" aria-live="polite">
        {s.notices.map((n) => (
          <div key={n.id} className={`toast ${n.kind}`} role={n.kind === 'error' ? 'alert' : 'status'}>
            <span>{n.text}</span>
            <button type="button" onClick={() => dismissNotice(n.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
      {s.pending && (
        <Modal title="Please confirm" onClose={() => answerConfirm(false)}>
          <p style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{s.pending.text}</p>
          <div className="modal-actions">
            <button type="button" data-autofocus onClick={() => answerConfirm(true)}>
              Yes
            </button>
            <button type="button" className="link" onClick={() => answerConfirm(false)}>
              No
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
