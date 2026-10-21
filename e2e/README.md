# Browser (end-to-end) tests

Headless Chrome drives the real UI against a real API and the development databases on `MYDELL`. They cover the nine Case
screens added after Registration / Adjustment / Tracking: Panel Hospitals, Non-Disclosure Info, Pay & Claim, MMA/CPT,
Case Audit Review, Case Transfer, Inpatient Case Listing, Claim ASCII and Case ASCII (validation messages, enable/disable
states, loading, saving, downloads), and the eight Finance screens (`finance.mjs`: searches, validation messages, selection rules,
detail panels, the SUN journal list and the bank file downloads).

`finance.mjs` alone can also run against the Vite dev server: `set E2E_BASE_URL=http://127.0.0.1:5173` and `node e2e/finance.mjs`.

## Run

1. Start a **second** API instance with a test-only signing key so no password is needed, and an output folder for the ASCII files
   (the production UI is served from its `wwwroot`, so run `npm run build` and copy `dist` there first):

   ```
   cd ../Genisis/src/Genisis.Api
   set ASPNETCORE_ENVIRONMENT=Development
   set Auth__JwtKey=<a test-only key of 32+ characters>
   set Ascii__ClaimFolder=%TEMP%\genisis-e2e-ascii\claim
   set Ascii__CaseFolder=%TEMP%\genisis-e2e-ascii\case
   dotnet run --no-launch-profile --urls http://localhost:5100
   ```

2. In another terminal, from `GenisisUI`:

   ```
   set E2E_JWT_KEY=<the same key>
   set E2E_ASCII_DIR=%TEMP%\genisis-e2e-ascii
   npm run e2e
   ```

   Optional: `E2E_BASE_URL` (default `http://localhost:5100`), `E2E_CHROME` (default `C:/Program Files/Google/Chrome/Application/chrome.exe`).

3. Restore the data the run wrote: `sqlcmd -S MYDELL -d HISDB -E -C -b -i e2e/cleanup.sql`.

## What they touch

- The ZZ test case `ZZ00000106` (test members `ZZHA0000518*01` / `ZZHA0000316*01`): non-disclosure, pay & claim, transfer (and back).
- One real case's audit review (`XI00002733`, which has no audit row) and the audit status on its cross reference.
- MMA procedures / fees: added and deleted again by the test itself.
- ASCII: Claim ASCII payor `GC` (accepted) and `AN` (rejected), Case ASCII payor `BI`; this flags the exported claims / cases and takes batch numbers.
  Nothing is bordxed for real: the bordx request is intercepted and answered by the test.

- Finance (`finance.mjs`): read only. It never confirms a save, post, reversal, stop or re-issue; it uses SUN batch / payor `ST`
  (Jul–Aug 2021), receipt `RB55092`, invoice `S34041`, case `ST00073162` and credit reference `06082021`.

`cleanup.sql` undoes all of it (idempotent). The suites depend on that development data; if the data changes, adjust the case / payor numbers at the top of each suite.
Never point them at production.

## Layout

- `lib.mjs` — browser start-up, token, and the helpers (`type`, `click`, `toast`, `rowsOf`, ...).
- `mint.mjs` — signs the login token with `E2E_JWT_KEY`.
- one file per suite; `run.mjs` runs them in order.
