# Demo websites — NOVA and Forma

The standalone Next.js app provides two demo platforms for Ghost recording and replay. It was previously named `tests/`; automated desktop checks remain under the repository's `scripts/`, and API tests under `backend/tests/`.

## Setup

From the repository root, with Node.js 22.12+:

```sh
npm --prefix demo-websites ci
npm --prefix demo-websites run dev
```

| Site | Local login | Demo account |
| --- | --- | --- |
| NOVA | http://127.0.0.1:3100/nova/login | `alex@nova.test` / `nova-demo` |
| Forma | http://127.0.0.1:3100/login | `demo@forma.test` / `ghost-demo` |

Session markers and sample records persist in the current browser's localStorage. They are separate from Ghost and PostgreSQL. These are public demo accounts; the websites do not send real payments or emails. Use the sites' reset controls to restore the initial sample data.

For a production build:

```sh
npm --prefix demo-websites run build
npm --prefix demo-websites start
```

Both development and production scripts bind to localhost on port 3100. Alternatively, run `docker compose up --build -d demo-websites` from the root. If this project is deployed separately (for example on Vercel), set its project root to **`demo-websites`** following the folder rename.

## Recording scenarios

**Forma:** `/finance` supports invoice filters, details, payment status edits and CSV export. `/users` supports customer search, creation, pausing/reactivating, and CSV export. Sign in before recording an export-only task; use `/login` when intentionally testing login capture.

**NOVA:** `/nova` is the store home, with orders, products, customers and other demonstration sections. `/nova/restocking` is the Monday buying review:

1. Sign in and choose **Load five-product demo stock** before recording. This resets demo planning inputs and stock; it is setup, not a recurring business action.
2. Review the fixed sample period, inventory, suppliers and budget.
3. Record downloading sales CSV, inventory CSV and Excel for approval.
4. Stop and test the recording in Ghost; inspect the verified files.
5. Outside capture, change the hoodie stock to 100 and save/recalculate. Replay to compare fresh outputs.

The website computes a reference workbook. Ghost's separate NOVA pipeline computes its own report from verified CSV exports. No supplier order is placed. The sample dates are in October 2026 and do not follow the current calendar automatically.

Bundled pre-taught Ghost recordings target `https://hackathon-screenpipe.vercel.app`, not localhost. For local testing, configure a local browser node and record a fresh task. Changing a URL does not rewrite an existing recording. See the [main reviewer walkthrough](../README.md#2-try-a-workflow).

## Checks

Install root dependencies as well as this project's dependencies. From the repository root:

```sh
node demo-websites/scripts/check-restocking.mjs
npm --prefix demo-websites run build
npm --prefix demo-websites run typecheck
```

With Ghost built (`npm run build`), a local website server running, and a graphical desktop:

```sh
NOVA_URL=http://127.0.0.1:3100 node demo-websites/scripts/check-nova.mjs
NOVA_URL=http://127.0.0.1:3100 node demo-websites/scripts/check-restocking-replay.mjs
node demo-websites/scripts/check-electron.mjs
```

These use isolated Electron profiles and real browser actions against demo data. The replay check verifies downloads; layout checks alone do not establish replay reliability. Run checks sequentially because some use fixed debugging ports. Artwork provenance is in [public/nova/ASSETS.md](public/nova/ASSETS.md).
