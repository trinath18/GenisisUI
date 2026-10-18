// Runs the browser suites against a running API + UI (see e2e/README.md). Usage: npm run e2e
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const suites = ['panel-nondisclosure-payclaim-mma.mjs', 'audit-transfer-listing.mjs', 'ascii-exports.mjs', 'worksheet.mjs', 'worksheet-enquiry.mjs']

for (const name of ['E2E_JWT_KEY', 'E2E_ASCII_DIR']) {
  if (!process.env[name]) {
    console.error(`${name} is not set. See e2e/README.md.`)
    process.exit(2)
  }
}

let failed = 0
for (const suite of suites) {
  console.log(`\n=== ${suite}`)
  const result = spawnSync(process.execPath, [path.join(here, suite)], { stdio: 'inherit', env: process.env })
  if (result.status !== 0) failed++
}

console.log(failed === 0 ? '\nAll suites passed.' : `\n${failed} suite(s) failed.`)
console.log('The suites write to the ZZ test case and a few real rows. Restore them now: sqlcmd -S MYDELL -d HISDB -E -C -b -i e2e/cleanup.sql')
process.exit(failed === 0 ? 0 : 1)
