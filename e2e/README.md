# Browser (end-to-end) tests

Headless Chrome drives the real UI against a real API and the development databases on `MYDELL`. They cover Case Registration
(`case-registration.mjs`: finding the member, what an expired membership does to Register, the save messages in the desktop's order, the
confirmations and one real registration) and the nine Case screens added after Registration / Adjustment / Tracking: Panel Hospitals, Non-Disclosure Info, Pay & Claim, MMA/CPT,
Case Audit Review, Case Transfer, Inpatient Case Listing, Claim ASCII and Case ASCII (validation messages, enable/disable
states, loading, saving, downloads), the Worksheet and Invoice menus (`worksheet.mjs`: Tracking, Send to A/C, Send to A/R, scan codes, access; `worksheet-enquiry.mjs`: Worksheet Enquiry; `worksheet-adjustment.mjs`: Worksheet Adjustment), and the eight Finance screens (`finance.mjs`: searches, validation messages, selection rules,
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

## Data dependence

The suites ran first on a trimmed development database and then on the full one, and three checks had assumed the trimmed data. The Claim ASCII check now reads the record count from the file (header, N records, trailer T<N>) instead of expecting 4; the listing suite patches the search result so that ZN00007106 has no group company (a complete database has no group worksheet without one, which is the case the group-company rule is for); and the Tracking scan check waits for the search to finish instead of for a fixed 600 ms (the search is slower on the full tables).

## What they touch

- The ZZ test case `ZZ00000106` (test members `ZZHA0000518*01` / `ZZHA0000316*01`): non-disclosure, pay & claim, transfer (and back).
- Case Registration (`case-registration.mjs`): registers **one real case** for the ZZ test member as user `E2E` (a new `ZZ` case number, the ten rows
  the save writes and the ZZ counter in `CAQ2013`), then tries the same patient and admission date again and answers No. `cleanup.sql` deletes every case
  opened by `E2E` on the ZZ payor, with its rows in the nine case tables and the cross reference, and puts the ZZ counter back. The suite starts by
  checking that no such case is left from an earlier run. Run `cleanup.sql` after every run of this suite.
- One real case's audit review (`XI00002733`, which has no audit row) and the audit status on its cross reference.
- MMA procedures / fees: added and deleted again by the test itself.
- Worksheet suite (Tracking, Send to A/C, Send to A/R) also checks the search layout: the criteria in the right-hand panel, the results on the first screen, the panel scrolling and sticking, and stacking on a narrow window.
- Worksheet Adjustment suite: reads real worksheets and intercepts every request that writes (the save, the debit note numbering, the excess letter, which marks the case), so nothing is written; the notes, the Excess letter and Final LG are checked against fixtures.
- Worksheet Enquiry suite: read-only; it picks a case with several worksheet versions through the API and writes nothing.
- Worksheet suite: reads real worksheets (payors `XI`, `AC`, cases `ZZ…`); the three POSTs that would change data (tracking update, send to A/C, send to A/R) are intercepted and answered by the test, so nothing is written (the database writes are covered by the API's rolled-back database tests).
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
