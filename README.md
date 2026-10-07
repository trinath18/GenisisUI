# GenisisUI

React (Vite + TypeScript) front end for Genisis, the browser replacement of the MedixHIS VB6 desktop app.
It talks to the [Genisis API](https://github.com/trinath18/Genisis); users only need a browser.

## Run locally

Prerequisites: Node 20+ and the Genisis API running on http://localhost:5000.

```
npm install
npm run dev
```

Open http://localhost:5173 and log in with a MedixHIS user (`HISMaintenance.dbo.USR`). The dev server proxies `/api`
to the API; set `GENISIS_API_URL` to point the proxy elsewhere, or `VITE_API_URL` to call an API on another origin.

## Screens

- Login (same users/passwords as MedixHIS; forced password change supported)
- Menu shell, with items enabled from `USR.USRAccess` like the VB6 `CheckAccess`
- Membership > Enquiry: search by membership no / IC / name / policy no, then Prin Detail, Supp, Adjust History,
  Current Case, Case History, Mem History, Account and Notes tabs

Membership Registration and Adjustment are placeholders until their write endpoints are migrated.

## Build

```
npm run build   # output in dist/, served by the API in the single-exe build (see Genisis/publish-win.ps1)
npm run lint
```
