# Ghost — Hackathon teammate guide

Updated October 16, 2026. Start here to run the project, understand its folders, and rehearse the demo. For a detailed inventory, see [Implemented features](IMPLEMENTED_FEATURES.md).

## 1. What we are building

Ghost turns a workflow description into an editable board. You teach browser steps by performing them in Ghost's embedded browser, then replay the recording with observable checks. Browser downloads can feed local data-processing nodes that produce reports.

Current discovery uses a five-second mock preparation stage followed by OpenAI-generated **simulated activity**. It does not read Screenpipe history. A generated board is a plan, not a completed automation.

```text
Home request → Electron IPC → Fastify → OpenAI simulation → PostgreSQL workflow
                                      ↓
                           Open saved workflow board
                                      ↓
                    Teach browser node in WebContentsView
                                      ↓
                 Local recording + encrypted saved login inputs
                                      ↓
                  Test recording → verified results + downloads
                                      ↓
                     Local processing → generated reports
```

## 2. Before starting

- Get the team's repository checkout, including the latest requested files. Files that are only on another teammate's machine will not appear through `git pull` until shared/committed.
- Install Node.js **22.12 or newer**; Node 24 is recommended. Use npm with the checked-in lockfiles.
- Install Docker with Compose for local PostgreSQL, or obtain an approved development database connection from the team.
- Use a graphical desktop for Electron. Renderer-only web preview cannot record/replay native browser sessions.
- Obtain your development OpenAI API key separately. Keep it in `backend/.env`, never in source, screenshots, prompts, or renderer variables.

There are **three separate npm projects**: root, `backend/`, and `tests/`. Installing at the root does not install the other two.

## 3. First-time installation

Run from the repository root:

```sh
npm ci
(cd backend && npm ci)
(cd tests && npm ci)
```

Prepare backend configuration **only if `backend/.env` does not already exist**:

```sh
cp backend/.env.example backend/.env
```

Edit `backend/.env`. The supplied local database example matches Compose:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3001
LOG_LEVEL=info
DATABASE_URL=postgresql://ghost:ghost_dev@127.0.0.1:5433/ghost?schema=public
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
OPENAI_API_KEY=YOUR_DEVELOPMENT_KEY
OPENAI_MODEL=gpt-4.1-mini
```

The database credentials above are for the local demo container only. If using the team's database, replace DATABASE_URL with the privately supplied value and skip starting local PostgreSQL. Do not overwrite an existing teammate configuration or reset a shared database.

Initialize the local database:

```sh
cd backend
docker compose up -d --wait
npm run prisma:generate
npm run prisma:deploy
npm run prisma:status
```

`prisma:deploy` applies existing migrations. Use `prisma:migrate -- --name your_change` only when intentionally developing a schema change; it requires shadow-database permissions. Do not use database reset commands as a setup shortcut.

## 4. Start the demo: three terminals

Open each terminal at the repository root.

**Terminal 1 — API**

```sh
cd backend
npm run dev
```

**Terminal 2 — practice websites**

```sh
cd tests
npm run dev
```

**Terminal 3 — Ghost desktop**

```sh
npm run dev
```

| Service | Address / purpose |
| --- | --- |
| API health | http://127.0.0.1:3001/health — also checks database connectivity |
| API documentation | http://127.0.0.1:3001/docs/ |
| OpenAPI JSON | http://127.0.0.1:3001/docs/json |
| Forma login | http://127.0.0.1:3100/login |
| Forma finance / users | `/finance` and `/users` on port 3100 |
| NOVA store login | http://127.0.0.1:3100/nova/login |
| Ghost | Native Electron window started by the root command |

Check the API before testing discovery:

```sh
curl --fail http://127.0.0.1:3001/health
```

The desktop defaults to the local API. To use a different approved endpoint on Linux/macOS:

```sh
GHOST_BACKEND_URL=https://your-development-api.example npm run dev
```

PowerShell: set `$env:GHOST_BACKEND_URL = 'https://your-development-api.example'`, then run `npm run dev`. Remote encrypted-input backup requires HTTPS; local loopback development permits HTTP. Changing backend environment variables requires restarting the API. Screenpipe does not need to run for this demo.

Stop development servers with Ctrl+C in their terminals. `docker compose stop` from `backend/` stops the local database while retaining its volume. Do not remove the volume if you want to retain saved workflows.

## 5. Repository map

| Folder or file | What it does / when to edit it |
| --- | --- |
| `src/main/` | Privileged Electron logic: windows, embedded browser, recording, replay, file access, backend requests and scheduling |
| `src/main/teachingBrowser.ts` | Browser lifecycle, native view bounds/visibility and recording/replay IPC |
| `src/main/replayRecording.ts` | Executes recorded actions and verifies their outcomes |
| `src/main/prepareReplay.ts`, `replayPlan.ts` | Builds replay steps, preserves blockers and applies saved input overrides |
| `src/main/recordingStore.ts` | Local session persistence, inputs, checkpoints and run metadata |
| `src/main/recordingSecrets*.ts`, `loginVault.ts` | Encrypted credentials and encrypted backend backups |
| `src/main/dataProcessing/` | Reads verified browser outputs, processes datasets and writes reports |
| `src/main/workflowScheduler.ts` | Device-local schedules for supported processing graphs |
| `src/preload/` | Allowlisted renderer bridge and browser event capture; do not expose Node directly to websites |
| `src/shared/` | Cross-process types, action/locator contracts and DOM operations |
| `src/renderer/src/pages/` | React screens: Home, workflow list/editor and Record Step |
| `src/renderer/src/components/` | Dialogs, inspectors, run summaries and shared UI |
| `src/renderer/src/styles/` | App layouts, responsive rules and visual styles |
| `src/renderer/src/assets/` | Bundled artwork, application images and other assets |
| `src/renderer/src/data/` | UI data/helpers and remaining preview content; do not assume all entries are backend records |
| `backend/src/modules/` | Workflow CRUD, discovery and encrypted-recording-secret API modules |
| `backend/src/contracts/` | Typed workflow/data-processing contracts and validation |
| `backend/src/config/`, `database/`, `errors/` | Environment validation, Prisma client and centralized errors |
| `backend/prisma/` | Schema and versioned SQL migrations |
| `backend/prisma.config.ts` | Prisma CLI configuration |
| `backend/compose.yaml` | Local PostgreSQL container and persistent volume |
| `backend/tests/` | Backend tests; some require PostgreSQL and temporary-schema permissions |
| `tests/app/` | Next.js practice websites; this folder is an actual web application |
| `tests/components/` | Forma components and NOVA components under `nova/` |
| `tests/public/` | Practice-site static assets, including generated NOVA product artwork |
| `tests/scripts/` | Electron checks for the practice websites |
| `scripts/` | Desktop/unit/integration test harnesses; `scripts/fixtures/` contains controlled test pages |
| `examples/` | Example workflow configurations for developers |
| `docs/` | Guides, implementation explanations and historical test reports |
| `out/` | Generated Electron build; edit `src/`, not this output |
| `backend/dist/`, `tests/.next/` | Generated backend / Next.js builds |
| `node_modules/` | Installed dependencies, independently present in all three projects |
| `.agents/`, `.codex/` | Coding-assistant configuration; not required application services |

## 6. App walkthrough: generate and save a board

1. Start all three services and verify API health.
2. Open Ghost, enter Home, and describe your task. For example:
   > On http://127.0.0.1:3100/finance, filter invoices by Paid and export the filtered CSV. Keep this browser task in one browser node.
3. Select **Find my workflow**. A generating card appears under **Your workflows**. The mock stage takes about five seconds; AI generation and saving take additional time.
4. Open the completed card with **Open board**. Review the generated description and nodes; simulation can still require corrections.
5. Click a browser node to open its centered details dialog. Check its starting URL. Keep the full sequence on that website in one browser node.
6. Arrange nodes or edit details, then select **Save changes**. Reopen from Home to confirm backend persistence.

If you do not have an OpenAI key, use **Workflows → New workflow**, then add/configure a browser node and save it. Existing saved workflows and local recording do not need a new AI generation request.

Deleting a saved workflow uses the backend delete operation. Use a disposable demo workflow when testing deletion.

## 7. Teach and replay a browser step

Use Forma first for a repeatable demo:

| Site | Demo email | Demo password |
| --- | --- | --- |
| Forma | `demo@forma.test` | `ghost-demo` |
| NOVA | `alex@nova.test` | `nova-demo` |

These are intentionally public fixture credentials, not real accounts.

1. Set the browser node's URL to `http://127.0.0.1:3100/login` to include login, or `/finance` for an already-authenticated task.
2. Open **Needs teaching / Start recording** from the browser node. Check the address bar and wait until the website loads.
3. Perform the task normally. For a compact demo: log in, open Finance, select **Paid**, and export CSV. Wait for the download to finish.
4. Select **Stop recording**. Review the captured events and any blockers. Passwords are saved encrypted, rather than as ordinary exported input text.
5. Before replay, restore the same starting state **outside capture**. Sign out if the recording includes login. Reset fixture data if the recording changed invoices/customers. Use Ghost's browser profile: resetting data in your separate Chrome window does not reset Ghost's data.
6. Select **Test recording**, review the planned actions, then choose **Start test · Fast** or **Demo replay · Slow + highlights**.
7. Watch the progress. The slow mode displays action targets and is useful for presenting; both modes execute the same real website actions.
8. Open **View run results**. Check verified actions, failures and downloaded artifacts. Inspect the CSV to confirm its rows match the filter.
9. Return to the workflow and reopen the browser node to confirm the saved recording is reused.

An action may stop because the target is missing/ambiguous or its result cannot be verified. Read the action number and diagnostics; do not repeatedly replay a payment/send/delete after an uncertain result. Use the built-in revalidation/resume option only when offered.

**Button distinction:** the board's **Test run** is a local preview/validation action, not browser execution. Real browser replay is started from the browser recording screen. The board's processing run executes configured data-processing nodes using saved verified browser outputs; it does not automatically replay all browser nodes.

## 8. Practice websites

**Forma:** Finance supports invoice filtering, details, payment-state changes and CSV export. Users supports customer creation, searching, plan/status changes and CSV export. Data and demo sessions live in browser localStorage.

**NOVA:** A store dashboard with orders, inventory edits, customer history, analytics, campaign drafts, discounts, announcements and settings. Use `/nova/login`, then Orders → Paid → Export CSV. Settings can reset the demo data. Campaigns are drafts; the site does not send mail or charge cards.

NOVA's final responsive check and full Ghost record/replay acceptance are still pending. Do not present it as fully verified simply because the UI builds. Rehearse your exact NOVA sequence before the presentation.

## 9. Processing and scheduling

After a successful browser replay has produced a download:

1. Add a **Data Processing** node and connect its input to the relevant upstream browser output.
2. Configure an operation such as reading CSV/XLSX, filtering rows, aggregating, comparing datasets or generating a report.
3. If using generated logic, provide the objective, review the proposed plan and supplied-data permissions, test it, and approve/save the plan when the inspector requests it.
4. Save changes and run local processing. Review the run log and generated file artifacts.

Scheduling is local to the desktop and requires Ghost to remain open. Current schedules process **existing verified browser outputs**; they do not refresh those outputs by replaying browser nodes each morning. A daily end-to-end browser + Slack/email pipeline is not implemented.

## 10. What is saved where?

| Information | Location / sharing behavior |
| --- | --- |
| Workflow graph and metadata | PostgreSQL backend; teammates using that backend can access saved definitions |
| Recordings, downloaded files, replay checkpoints/reports | Electron user-data directory on the machine that ran Ghost |
| Login inputs | Encrypted locally; encrypted bundles can sync to the backend |
| Credential decryption key | Local device; backend ciphertext alone does not make credentials portable to another teammate |
| Browser cookies/session | Persistent Electron browser partition on that machine |
| Processing artifacts and schedules | Local desktop storage |
| Forma/NOVA records and demo login | localStorage within the browser profile used to open those websites |

On this Linux setup, Ghost's user data is under `~/.config/ghost-desktop/`. Other platforms use Electron's platform-specific user-data directory. Do not delete the profile to troubleshoot casually: it contains recordings, sessions and encryption keys. Exported JSON is not a portable plaintext-password backup.

## 11. Useful checks

From the repository root:

```sh
npm run typecheck
npm test
npm run build
npm run test:processing
npm run test:runtime-logic
(cd backend && npm run typecheck && npm test && npm run build)
(cd tests && npm run build && npm run typecheck)
```

Backend tests need a reachable database with permission to create/drop isolated test schemas. Electron checks require a graphical session; run them sequentially because harnesses use fixed debugging ports.

With Ghost built and the practice website running:

```sh
node scripts/check-demo-replay.mjs
node scripts/check-downloads.mjs
node scripts/check-saved-login.mjs
node scripts/check-next-replay.mjs
# Linux/macOS: repeat with the Forma users scenario
GHOST_DEMO_PAGE=users node scripts/check-next-replay.mjs
# NOVA UI/interaction check against your running port 3100 server
NOVA_URL=http://127.0.0.1:3100 node tests/scripts/check-nova.mjs
```

These are commands to run, not a claim they all passed today. Historical results and limitations are in [Implemented features](IMPLEMENTED_FEATURES.md) and the JSON reports under `docs/`. The NOVA script checks site interactions/layout, not full Ghost recording/replay.

For compiled startup, build each project first, then use `npm start` in the root, `backend/`, and `tests/` terminals.

## 12. Troubleshooting

| Symptom | First check |
| --- | --- |
| Home cannot load workflows | API process, `/health`, database URL and deployed migrations |
| Discovery fails | Backend `.env` API key, provider availability and `NODE_ENV=development`; inspect redacted backend errors |
| Nothing records in web preview | Use root `npm run dev` to launch Electron, not `dev:web` |
| Practice site is blank/unreachable | Start `tests/`, check port 3100 and use a complete HTTP URL |
| Login replay starts on the wrong page | Confirm saved start URL and sign-out state in Ghost's own browser profile |
| Saved password missing on a teammate's computer | Record the demo login on that device; the original machine's key is not shared through the backend |
| A replay blocker appears | Review target/outcome evidence and reproduce the correct initial state; re-record unsupported steps |
| Browser covers a dialog | Record the exact route/modal and reproduce after restart; native-view visibility must be coordinated through IPC |
| Electron sandbox helper error on Linux | Follow the root README's Linux sandbox setup; keep Chromium sandboxing enabled |
| Graphics problems | Linux defaults to software rendering; `GHOST_SOFTWARE_RENDERING=1 npm run dev` forces it |
| Port already occupied | Stop the previous copy of that service or deliberately configure a different port and matching client URL |

## 13. Team demo checklist

- Agree on one presenter machine; teach and test the recording on that machine.
- Verify database, API, websites and desktop are all running before presenting.
- Use public fixture accounts and disposable data.
- Rehearse generation, opening the board, teaching, slow replay and checking the CSV.
- Keep a saved working workflow for the recording demonstration if live generation is unavailable.
- Clearly describe discovery as simulated activity and browser actions as recorded/replayed actions.
- Do not claim Slack/email integrations, external OAuth, unattended browser scheduling, or every website is supported.
- Share changes through the team's normal Git process; do not commit `.env`, credentials, local profiles or recordings.

Further reading: [Recording and replay explained](recording-and-replay-explained.md), [Replay resilience](replay-resilience.md), [Backend details](../backend/README.md), [Practice websites](../tests/README.md).
