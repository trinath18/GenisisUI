import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from './Button'

/** What the user sees when a screen crashes while rendering: a clear message and two ways out. */
export function ErrorFallback({ onRetry, onHome }: { onRetry: () => void; onHome: () => void }) {
  return (
    <section className="error-panel" role="alert">
      <h2>Something went wrong on this screen</h2>
      <p>
        Your last change may not have been saved. You can try the screen again, or go back to the home page. If it keeps happening, tell support what you were
        doing.
      </p>
      <div className="modal-actions">
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
        <Button variant="link" onClick={onHome}>
          Go to the home page
        </Button>
      </div>
    </section>
  )
}

interface Props {
  children: ReactNode
  /** When this value changes (for example the route) a crashed screen is given a fresh start. */
  resetKey?: string
}

/** Keeps a rendering error inside one screen: the menu and the session stay usable instead of the whole page going blank. */
interface State {
  failed: boolean
  key?: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    return props.resetKey === state.key ? null : { failed: false, key: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('A screen failed to render', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <ErrorFallback onRetry={() => this.setState({ failed: false })} onHome={() => window.location.assign('/')} />
  }
}
