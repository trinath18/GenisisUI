import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorBoundary, ErrorFallback } from './ErrorBoundary'

describe('ErrorBoundary', () => {
  it('turns a render error into a state that shows the fallback', () => expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true }))

  it('renders its children when nothing failed', () => {
    const html = renderToStaticMarkup(createElement(ErrorBoundary, null, createElement('p', null, 'all good')))
    expect(html).toBe('<p>all good</p>')
  })

  it('the fallback is an alert with both ways out', () => {
    const html = renderToStaticMarkup(createElement(ErrorFallback, { onRetry: () => {}, onHome: () => {} }))
    expect(html).toContain('role="alert"')
    expect(html).toContain('Something went wrong on this screen')
    expect(html).toContain('Try again')
    expect(html).toContain('Go to the home page')
  })
})
