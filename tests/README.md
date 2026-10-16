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

For a dashboard-only task, sign in before recording. To test login replay, start at `/login` and record the demo credentials: Ghost saves passwords encrypted and fills them during replay. Sign out outside capture before repeating a login recording. See the [team walkthrough](../docs/TEAM_ONBOARDING.md).

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

## NOVA store

The second store is available at **http://127.0.0.1:3100/nova** (login at `/nova/login`). Forma keeps its existing routes and data. NOVA's demo login is **alex@nova.test / nova-demo**.

NOVA includes a reference-inspired home dashboard, orders, inventory, customer directory, analytics, campaign drafts, discount codes, store announcements, and settings. All mutations persist in the browser's `nova-store-v1` localStorage key. Its sign-in marker is separate from Forma. These are local demonstration accounts, not production authentication. The store does not charge cards or send emails; reviews and billing pages clearly show their empty/demo state.

Recorder scenario:

1. Record logging in at `/nova/login`.
2. Open **Orders**, choose **Paid** in the status filter, and select **Export CSV**.
3. Stop and test the recording in Ghost. Exported rows must all have Paid status.
4. A second scenario: open an order, change its status, add an internal note, and save. Reload to verify persistence. Avoid replaying that mutation against an already-modified state without resetting the demo.
5. Under **Products**, edit stock or price and save. Order totals retain their original unit prices.

Forms use stable IDs, accessible labels, native selects, semantic dialogs, and visible success messages. No iframes or external authentication are required. **Settings → Reset demo data** restores fixtures. The date range is deliberately fixed to the sample dataset in October 2026. The map and sparklines are illustrative; order totals and sales bars use the sample records, while lifetime product sales are labeled as seeded totals.

Build with `npm run build`. With a server running on port 3102, run `node tests/scripts/check-nova.mjs` from the repository root for isolated Electron interaction and responsive-layout checks; set `NOVA_URL` to use another local port. Product image generation details are in `public/nova/ASSETS.md`.
