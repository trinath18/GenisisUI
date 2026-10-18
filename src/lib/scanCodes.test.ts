import { describe, expect, it } from 'vitest'
import { isScanCode, resolveScanCode } from './scanCodes'

describe('isScanCode (Mid(ScanCode, 1, 2) = "LO")', () => {
  it('is true for anything starting LO, in any case', () => {
    expect(isScanCode('LOC001')).toBe(true)
    expect(isScanCode(' loc001')).toBe(true)
    expect(isScanCode('AC00000456')).toBe(false)
    expect(isScanCode('')).toBe(false)
  })
})

describe('resolveScanCode (SearchForm)', () => {
  it('opens a migrated screen', () => {
    expect(resolveScanCode(' loc001 ')).toEqual({ kind: 'open', route: '/case/registration' })
    expect(resolveScanCode('LOW003')).toEqual({ kind: 'open', route: '/worksheet/tracking' })
    expect(resolveScanCode('LOB001')).toEqual({ kind: 'open', route: '/case/listing' })
  })
  it('names a screen that is not migrated yet', () => expect(resolveScanCode('LOP001')).toEqual({ kind: 'notMigrated', label: 'Payment to Hospital' }))
  it('does not open the worksheet registration and adjustment codes, which the desktop had commented out', () => {
    expect(resolveScanCode('LOW001')).toEqual({ kind: 'unknown', code: 'LOW001' })
    expect(resolveScanCode('LOW002')).toEqual({ kind: 'unknown', code: 'LOW002' })
  })
})
