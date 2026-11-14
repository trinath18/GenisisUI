import { describe, expect, it } from 'vitest'
import { adjacentFrom, memberAlerts } from './memberAlerts'

describe('Member Enquiry alerts', () => {
  it('shows the plan special note, as the desktop pops it up', () => {
    expect(memberAlerts({ MBMStatus: 'A', INSCode: 'Q', PLNSpecialNote: '***TO NOTIFY AXA***' }, { MessagePromt: null })).toEqual([
      { text: '***TO NOTIFY AXA***', critical: false },
    ])
  })

  it('lists the messages in the desktop order', () => {
    const alerts = memberAlerts(
      { MBMGLIssuance: 'N', MBMStatus: 'S', MBMSuspendDate: '2024-03-05T00:00:00', INSCode: 'H', MBMFullCover: 'Y', MBMVIP: 'Y', PLNSpecialNote: 'Note' },
      { MessagePromt: 'Prompt' },
    ).map((a) => a.text)
    expect(alerts[0]).toBe('GL is NOT allowed for this member')
    expect(alerts[1]).toMatch(/^Membership has been suspended since .+\.$/)
    expect(alerts.slice(2)).toEqual(['Please give priority to this member!', 'Please give priority. This member is a VIP!', 'Prompt', 'Note'])
  })

  it('gives priority and VIP messages only for insurer types F and H, and nothing for a plain member', () => {
    expect(memberAlerts({ INSCode: 'Q', MBMFullCover: 'Y', MBMVIP: 'Y' }, null)).toEqual([])
    expect(memberAlerts({ MBMStatus: 'A' }, { MessagePromt: 'None' })).toEqual([])
  })

  it('starts Pre / Next from the box, or the member shown', () => {
    expect(adjacentFrom(' ACHA1 ', 'ACHA2')).toBe('ACHA1')
    expect(adjacentFrom('', 'ACHA2')).toBe('ACHA2')
    expect(adjacentFrom('', null)).toBe('')
  })
})
