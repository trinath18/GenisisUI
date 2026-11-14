import { describe, expect, it } from 'vitest'
import { containsRoute, menuSections, visibleMenu } from './menu'
import type { MenuNode, MenuSection } from './menu'

const sections: MenuSection[] = [
  {
    label: 'Case',
    items: [
      { to: '/case/registration', label: 'Registration', access: 1, group: 'Case Workflow' },
      { to: '/case/enquiry', label: 'Enquiry', access: 2, group: 'Case Workflow' },
      { to: '/case/listing', label: 'Listing', access: 1 },
      { to: '/case/ascii', label: 'Case ASCII', access: 1, group: 'Exports' },
    ],
  },
  { label: 'Payment', items: [{ to: '/payment/x', label: 'X', access: 9 }] },
]

const labels = (nodes: MenuNode[]): unknown[] => nodes.map((n) => (n.kind === 'link' ? n.label : { [n.label]: labels(n.children) }))

describe('the FIS-style menu', () => {
  it('nests each sub-menu in its section and leaves out what the user may not open', () => {
    const tree = visibleMenu(sections, (p) => p === 1)
    expect(labels(tree)).toEqual([{ Case: [{ 'Case Workflow': ['Registration'] }, 'Listing', { Exports: ['Case ASCII'] }] }])
  })

  it('shows everything to a user with every right, in the desktop top-menu order', () => {
    const tree = visibleMenu(menuSections, () => true)
    expect(tree.map((n) => n.label)).toEqual([
      'Membership',
      'Contribution Billing',
      'Case',
      'Invoice',
      'Worksheet',
      'Authorize Claims',
      'Claim Bordx',
      'Finance',
      'Payment',
      'Receipt',
      'Posting',
      'Maintenance',
    ])
    const count = (nodes: MenuNode[]): number => nodes.reduce((n, c) => n + (c.kind === 'link' ? 1 : count(c.children)), 0)
    expect(count(tree)).toBe(103)
  })

  it('opens the group that holds the page shown', () => {
    const [caseGroup] = visibleMenu(sections, () => true)
    expect(containsRoute(caseGroup, '/case/enquiry')).toBe(true)
    expect(containsRoute(caseGroup, '/case/enquiry/123')).toBe(true)
    expect(containsRoute(caseGroup, '/case/enquiry-other')).toBe(false)
    expect(containsRoute(caseGroup, '/payment/x')).toBe(false)
  })
})
