# GenisisUI

React (Vite + TypeScript) front end for Genisis, the browser replacement of the legacy VB6 desktop app.
It talks to the [Genisis API](https://github.com/trinath18/Genisis); users only need a browser.

## Run locally

Prerequisites: Node 20+ and the Genisis API running on http://localhost:5000.

```
npm install
npm run dev
```

Open http://localhost:5173 and log in with an existing desktop user (`USR` table). The dev server proxies `/api`
to the API; set `GENISIS_API_URL` to point the proxy elsewhere, or `VITE_API_URL` to call an API on another origin.

## Screens

- Login (same users/passwords as the desktop app; forced password change supported)
- Menu shell, with items enabled from `USR.USRAccess` like the VB6 `CheckAccess` (the API checks the same rights)
- Membership
  - Registration (`frmMemberEntry`)
  - Adjustment (`frmNewMBMAdjustment`): every endorsement type, Others Details, Supplementary, history and fees tabs
  - Enquiry (`frmNewMBMEnquiry`): all desktop tabs, including HIS Benefits, Acc History, Fees, Non Disclosure, Policy Terms,
    LT Limit, Policy Wording, T/O Claims and WS
  - Upload Bordx (`FrmNewMBMEndt10`): Verify, Upload, Stop, Print and Generate ASCII
  - Tracking (`FrmNewMBMTracking`): all 22 report types, every filter, Search and Print to File (CSV)
  - Leaflet & Card (`frmMainReport`): leaflets and cards as PDF, card export as CSV
  - Card Sending Mode (`frmMembershipCardControl`)
  - Member Reinstatement (`frmMBMReintstatement`)
  - MCO Pending (`frmMBMMCOPending`)
  - Deletion (`frmDeleteMembers`): Go lists the selection; Delete is only offered for the listed criteria and confirms with the counts
  - Upload Membership Excel / Generate Membership ASCII (Pluto) (`frmMembershipExcelPluto`, `frmMembershipASCIIPluto`)
  - Temp MBM Reg (`FrmTempMBMReg`): the Registration form pre-filled from a previous membership as a renewal
  - Temp MBM Adj (`FrmTempMBMAdj`): the Adjustment screen for memberships of temporary payors only
- Maintenance: Plan, Benefits, Entity, Accounts, Account Transaction (`frmMMASchedule`), MMA (Procedures/OPCS, `frmMMAEntry`) and Security: Department (`frmGroupMaintenance`), Role Management (`frmUserMaintenance`) and User Permission (`frmUserPermissionMaintenance`, with the access matrix)

## Code structure

New screens follow a feature-based layout:

```
src/
  api/client.ts            shared Axios client (JWT, errorMessage, rethrowBlobError)
  components/              shared presentational components (DataTable, FieldGrid)
  components/common/       FormField, CodeSelect
  lib/                     formatting, file download / CSV helpers
  features/<area>/<feature>/
    api/                   the feature's HTTP calls (components never call axios directly)
    components/            one component per tab / panel
    pages/                 the routed page: loads data and wires the components
    constants.ts           code values, option lists, messages, limits
    types.ts               request / response contracts
```

`features/membership/*` and `features/maintenance/*` use it; the older
screens in `pages/` keep their original layout.

Conventions:

- Server state goes through TanStack Query; query keys are defined next to the feature's API module.
- No magic values: endorsement types, member types, export options and similar codes are named in `constants.ts`.
- A loaded record is edited in a component rendered with a `key` per load, so it starts from the stored values without
  syncing state in effects (see `AdjustmentEditor`).
- Every data view handles loading, empty and error states; errors show the API's Problem Details `message`.
- Validation messages come from the API (the server validates every request); the UI repeats only the checks the desktop
  made before calling the server.
- TypeScript runs in `strict` mode.

## Build

```
npm run build   # output in dist/, served by the API in the single-exe build (see Genisis/publish-win.ps1)
npm run lint
```
