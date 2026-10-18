import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mint } from './mint.mjs'

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5100'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function start(downloadPath) {
  const shots = path.join(os.tmpdir(), 'genisis-e2e-shots')
  fs.mkdirSync(shots, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath: process.env.E2E_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on(
    'console',
    (m) => ['error', 'warning'].includes(m.type()) && !/status of (400|404|409)/.test(m.text()) && problems.push(`console.${m.type()}: ${m.text()}`),
  )
  page.on('response', (r) => r.status() >= 500 && problems.push(`HTTP ${r.status()} ${r.url()}`))
  const token = mint()
  await page.evaluateOnNewDocument((t) => {
    localStorage.setItem(
      'genisis.session',
      JSON.stringify({ token: t, expiresUtc: '2035-01-01T00:00:00Z', user: { userCode: 'E2E', userName: 'E2E Tester', access: '1'.repeat(30) } }),
    )
    localStorage.setItem('nav-collapsed', '1')
  }, token)
  if (downloadPath) {
    fs.mkdirSync(downloadPath, { recursive: true })
    const client = await page.createCDPSession()
    await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.resolve(downloadPath) })
  }
  let pass = 0
  let fail = 0
  const t = {
    shots,
    browser,
    page,
    problems,
    check(name, ok, extra = '') {
      if (ok) pass++
      else fail++
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ' + extra}`)
    },
    summary() {
      console.log(`\n${pass} passed, ${fail} failed`)
      console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'console/network clean')
      return fail === 0 && problems.length === 0
    },
    async go(route) {
      await page.goto(`${BASE}${route.startsWith('/') ? route : `/case/${route}`}`, { waitUntil: 'networkidle0' })
      await page.waitForSelector('h2')
      await sleep(300)
    },
    async btn(text) {
      const h = await page.evaluateHandle(
        (x) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === x && !b.closest('.toasts')),
        text,
      )
      const el = h.asElement()
      if (!el) throw new Error('no button ' + text)
      return el
    },
    async click(text, wait = 300) {
      await (await t.btn(text)).click()
      await sleep(wait)
    },
    async isDisabled(text) {
      return (await t.btn(text)).evaluate((b) => b.disabled)
    },
    errors: () => page.$$eval('.field-error', (els) => els.map((e) => e.textContent)),
    toasts: () => page.$$eval('.toast span', (els) => els.map((e) => e.textContent)),
    async toast(substr, ms = 8000) {
      const end = Date.now() + ms
      while (Date.now() < end) {
        if ((await t.toasts()).some((x) => x.includes(substr))) return true
        await sleep(150)
      }
      return false
    },
    async field(label) {
      const h = await page.evaluateHandle(
        (l) =>
          [...document.querySelectorAll('label.form-field')]
            .find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === l)
            ?.querySelector('input,select,textarea'),
        label,
      )
      const el = h.asElement()
      if (!el) throw new Error('no field ' + label)
      return el
    },
    async type(label, text) {
      const el = await t.field(label)
      await el.focus()
      await page.keyboard.down('Control')
      await page.keyboard.press('KeyA')
      await page.keyboard.up('Control')
      await page.keyboard.press('Backspace')
      if (text) await page.keyboard.type(text)
    },
    async value(label) {
      return (await t.field(label)).evaluate((e) => e.value)
    },
    async select(label, value) {
      await (await t.field(label)).select(value)
      await sleep(150)
    },
    async readValue(label) {
      return page.evaluate(
        (l) =>
          [...document.querySelectorAll('label.form-field')]
            .find((x) => x.querySelector('span')?.textContent.replace('*', '').trim() === l)
            ?.querySelector('input')?.value ?? null,
        label,
      )
    },
    async checkbox(label) {
      await page.evaluate(
        (l) =>
          [...document.querySelectorAll('label.check-field')]
            .find((x) => x.textContent.trim() === l)
            ?.querySelector('input')
            ?.click(),
        label,
      )
      await sleep(120)
    },
    async waitFor(fn, ms = 10000) {
      const end = Date.now() + ms
      while (Date.now() < end) {
        try {
          if (await fn()) return true
        } catch {
          /* retry */
        }
        await sleep(150)
      }
      return false
    },
    async yes() {
      await page.waitForSelector('[role=dialog]')
      await (await t.btn('Yes')).click()
      await sleep(400)
    },
    async tab(name) {
      await page.evaluate((n) => [...document.querySelectorAll('[role=tab]')].find((x) => x.textContent.trim() === n)?.click(), name)
      await sleep(250)
    },
    rows: (caption) =>
      page
        .$$eval(`table[aria-label="${caption}"] tbody tr`, (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())))
        .catch(() => []),
    async rowsOf(caption) {
      return page.evaluate((c) => {
        const tables = [...document.querySelectorAll('table')]
        const table = tables.find((x) => x.querySelector('caption')?.textContent.trim() === c) ?? tables.find((x) => x.getAttribute('aria-label') === c)
        return table ? [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())) : null
      }, caption)
    },
  }
  return t
}
