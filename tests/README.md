# Forma — Ghost recording fixtures

Standalone Next.js application alongside `backend` with two dashboards:
- `/finance`: invoice search/filtering, details, mark as paid, CSV export.
- `/users`: customer search/filtering, create customers, pause/reactivate, CSV export.
- `/login`: demo sign-in; signed-out dashboard visitors redirect here.

## Run

```sh
cd tests
npm install
npm run dev
```

Open http://127.0.0.1:3100 in Ghost's teaching browser.

Demo login: **demo@forma.test** / **ghost-demo**.

This is local demo authentication, not production security. Session and edited records use localStorage in the current browser profile. No real accounts, emails, payments, external frames, analytics or OAuth are involved. Charts are explicitly illustrative; summary cards and tables derive from current records.

## Record and replay

Sign in manually before recording: Ghost masks passwords and must not replay credentials.

1. Finance: reset data, start recording at `/finance`, filter Overdue, review INV-2046, mark it paid, close details, select Paid, export CSV, stop. Verify paid state, updated totals and the downloaded CSV. Ghost saves downloads in the recording session’s downloads folder; wait for completion before stopping.
2. Customers: reset data, start at `/users`, add a uniquely named customer with a `.test` email, choose Growth, save, search that email, pause the account, export CSV, stop. Verify confirmation, paused state and the exported row.
3. Reset demo data outside the recording before replay to restore identical initial conditions. Login and reset are setup, not business workflow steps.

Controls use native forms, associated labels, stable IDs/test IDs, semantic tables, native selects and modal dialogs. No embedded frames, generated selector classes, shadow DOM or coordinate-dependent controls. Mutations expose persistent observable results. Compatibility with Ghost's complete recorder/replay engine must still be verified; accessible markup alone is not proof of replay reliability.

`npm run build` compiles the application. `npm start` serves the production build on port 3100. `npm run typecheck` checks TypeScript.

Data is isolated from Ghost's PostgreSQL backend. Sign out clears the demo session; Reset demo data restores the original invoices/customers.

## Electron smoke check

With the fixture server running and Ghost built, run from the repository root:

```sh
node tests/scripts/check-electron.mjs
```

This uses the real Ghost WebContentsView and recorder with an isolated profile. It checks login, payment/customer interactions, recorded events, persisted state and responsive widths (360, 768, 1024, 1440). It does not assert full replay or completed downloads. Screenshots are saved under `/tmp/forma-*.png`. The test requires a graphical Electron environment and uses debugging port 9246 (override with GHOST_FIXTURE_DEBUG_PORT).
