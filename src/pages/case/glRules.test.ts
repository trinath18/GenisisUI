import { describe, expect, it } from 'vitest'
import { caseEndpoints, glDecision, needsTakeOver } from './glRules'

describe('caseEndpoints (Case Adjustment keeps the addresses it always used)', () => {
  it('points at the case adjustment endpoints', () => {
    expect(caseEndpoints('AH 1/2')).toEqual({
      options: '/api/case/adjustment/gl-options',
      defaults: '/api/case/adjustment/AH%201%2F2/gl',
      check: '/api/case/adjustment/AH%201%2F2/gl/check',
      issue: '/api/case/adjustment/AH%201%2F2/gl',
    })
  })
})

describe('glDecision', () => {
  it('stops Case Adjustment when the amount is not within the limit', () => {
    expect(glDecision(false, { withinLimit: false, balance: '10.00' })).toEqual({ stop: 'Please check LG Amount' })
  })
  it('asks Case Adjustment "Are you sure?" when it is within the limit, whatever prompt the server sent', () => {
    expect(glDecision(false, { withinLimit: true })).toEqual({ ask: 'Are you sure?' })
    expect(glDecision(false, { withinLimit: true, prompt: 'something else' })).toEqual({ ask: 'Are you sure?' })
  })
  it('lets Final LG go on past the warning: it asks the server question and never stops', () => {
    expect(glDecision(true, { withinLimit: false, prompt: 'Please check LG Amount, do you want to continue?' })).toEqual({
      ask: 'Please check LG Amount, do you want to continue?',
    })
    expect(glDecision(true, { withinLimit: true, prompt: 'Are you sure?' })).toEqual({ ask: 'Are you sure?' })
    expect(glDecision(true, { withinLimit: true })).toEqual({ ask: 'Are you sure?' })
  })
})

describe('needsTakeOver', () => {
  it('is only a Final LG question and only when the server asks it', () => {
    expect(needsTakeOver(true, { withinLimit: false, takeOverCheck: true })).toBe(true)
    expect(needsTakeOver(true, { withinLimit: true })).toBe(false)
    expect(needsTakeOver(false, { withinLimit: false, takeOverCheck: true })).toBe(false)
  })
})
