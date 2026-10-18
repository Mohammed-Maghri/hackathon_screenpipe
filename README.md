# Ghost

Turn a routine into a workflow you can inspect, teach, replay, and review.

Ghost is an Electron desktop app built for the Screenpipe hackathon. It combines recorded activity discovery, a React Flow editor, a native teaching browser, verified downloads, and local CSV/Excel processing. NOVA and Forma are included demo websites for trying the browser workflows.

## Start here

| What you want to review | What you need |
| --- | --- |
| Open Ghost, create prepared NOVA/Forma workflows, edit nodes, replay their browser exports | Node.js and a desktop session; internet for the hosted demo websites |
| Run the demo websites on your machine | Node.js; see [demo-websites](demo-websites/README.md) |
| Discover workflows from your own recorded activity | Screenpipe with recordings and an AI preset, its local API key, the backend, PostgreSQL, and a backend OpenAI key |
| Run NOVA's complete calculation/report/delivery pipeline | Ghost plus Screenpipe's configured Slack connection to the demo destination; see the delivery limitation below |

**Prepared discovery is the default.** It creates local demo definitions, not evidence of an actual Screenpipe search. Switch to live mode explicitly to analyze recorded history. The two modes have separate workflow lists.

## 1. Launch the desktop app

Requirements: **Node.js 22.12 or newer** (Node 24 recommended), npm, Git, and a graphical desktop. Development has been exercised on macOS; Electron also targets Windows and Linux, but this is not a packaged cross-platform release. Linux needs Chromium's usual GTK/NSS libraries and a working sandbox.

```sh
git clone https://github.com/Mohammed-Maghri/hackathon_screenpipe.git
cd hackathon_screenpipe
git switch codex/submission
npm ci
```

On a fresh checkout, create the root configuration:

```sh
cp .env.example .env
```

Keep `VITE_GHOST_DISCOVERY_MODE=prepared` for the quickest review. Then:

```sh
npm run dev
```

This opens **Electron**, with its renderer served at `http://localhost:5173`. Opening that URL in a regular browser does not provide the native recording/replay bridge. The backend is optional for this prepared demo path.

For a compiled desktop run:

```sh
npm run build
npm start
```

There is no installer packaging command. To stop development, press **Ctrl+C** in its terminal. Restart the entire app after changing `.env`, main-process code, or preload code.

## 2. Try a workflow

From Home, submit either:

- **NOVA:** `Check sales and inventory and prepare next week's shopping list.`
- **Forma:** `Review overdue payments and prepare a finance report.`

Ghost creates a draft on this device and opens the editor. Changes persist locally. Click a node to select it; double-click to open its settings. The canvas supports adding nodes/connections, dragging, zooming, and fitting the graph.

For a short browser-only review:

1. Open the workflow's browser node and its recording page.
2. The prepared hosted task and public demo login are installed automatically for the supported NOVA/Forma URLs.
3. Choose **Test recording**, review the action summary, then start the test. Slow demo playback highlights the actions.
4. Inspect the completed downloads and run outcomes in **Results**.

NOVA exports sales CSV, inventory CSV, and a reference shopping-list workbook. Forma exports a finance CSV. A prepared task marked **Learned** has reusable teaching; it is not a completed run in your new workflow. A new run must produce its own verified results.

### Demo accounts and websites

| Website | Hosted login | Public demo credentials |
| --- | --- | --- |
| NOVA store | https://hackathon-screenpipe.vercel.app/nova/login | `alex@nova.test` / `nova-demo` |
| Forma finance | https://hackathon-screenpipe.vercel.app/login | `demo@forma.test` / `ghost-demo` |

These accounts belong to the included demo sites. Their session and sample edits are stored in that browser profile, separately from Ghost's workflow storage. Use the website's reset control to restore sample data before recording a mutation again. They do not process real payments.

### Run the websites locally

In another terminal, from the repository root:

```sh
npm --prefix demo-websites ci
npm --prefix demo-websites run dev
```

Open `http://127.0.0.1:3100/nova/login` or `http://127.0.0.1:3100/login` in Ghost's teaching browser. See the [demo website guide](demo-websites/README.md) for routes, recording scenarios, and build commands.

**The bundled prepared recordings target the hosted origin.** Starting the local website does not redirect those recordings. To use localhost, configure a browser node with the local URL, sign in, record its actions, and verify replay. Existing recordings retain their original URLs.

### Complete NOVA pipeline

The supported six-node NOVA graph validates the request, replays the browser exports, calculates restocking from that run's CSVs, writes reports, prepares/delivers a message, and requests review. Results includes Excel/CSV/JSON files, source hashes, comparisons, editable buying proposals, and approval records.

**Delivery is currently specific to the hackathon workspace.** The complete run attempts to post through Screenpipe to GHOST LLC `#daily-reports`, configured in [`src/main/screenpipeSlack.ts`](src/main/screenpipeSlack.ts). It sends during the delivery step, before the final report approval. Without access to that Slack connection, the delivery step fails; browser replay and local outputs can still be inspected. Reviewers should use the browser-only test above unless they intentionally want to exercise this integration. No supplier purchase is placed.

The Results scheduling controls create three one-time local runs due in one, two, and three minutes. Keep Ghost open; these are not a cloud scheduler and do not wake a closed app. Scheduled full runs use the same delivery behavior.

## 3. Optional: backend and live Screenpipe discovery

### Start PostgreSQL and the API

Install Docker Desktop/Engine with Compose v2, or supply your own PostgreSQL connection. From the repository root:

```sh
docker compose up -d --wait postgres
npm --prefix backend ci
cp backend/.env.example backend/.env
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:deploy
npm --prefix backend run dev
```

Copy the environment example only when `backend/.env` does not already exist. The default database URL is:

```dotenv
DATABASE_URL=postgresql://ghost:ghost_dev@127.0.0.1:5433/ghost?schema=public
```

In **`backend/.env`**, set `OPENAI_API_KEY` to your own key and optionally `OPENAI_MODEL` (default `gpt-4.1-mini`). The backend formats Screenpipe's final answer and provides AI processing/contract features. The backend key stays server-side.

Verify:

```sh
curl http://127.0.0.1:3001/health
```

Expected: `{"status":"ok","database":"up"}`. Interactive API docs are at `http://127.0.0.1:3001/docs/`. See the [backend guide](backend/README.md) for API and migration commands.

### Connect Screenpipe

1. Install and open [Screenpipe](https://screenpi.pe/). Grant capture permissions and record the activity you intend to analyze. Configure its AI preset. Bun is required for the token command below.
2. Obtain the local token with `bun x screenpipe@latest auth token`.
3. Set these values in the **root `.env`**:

```dotenv
VITE_GHOST_DISCOVERY_MODE=live
GHOST_BACKEND_URL=http://127.0.0.1:3001
SCREENPIPE_LOCAL_API_URL=http://localhost:3030
SCREENPIPE_LOCAL_API_KEY=your-local-screenpipe-token
```

4. Install Ghost's manual discovery Pipe:

```sh
npm run screenpipe:install
```

5. In Screenpipe, check that `ghost-workflow-discovery` has a working AI preset. Restart Ghost with `npm run dev` in a separate terminal from the backend.
6. Describe a specific routine and select the time range containing it. Ghost dispatches the Pipe, tracks its exact run, reads its final JSON, formats it through the API, saves the workflow in PostgreSQL, and opens the board.

The Pipe searches recording history; it does not execute the discovered website actions. Missing evidence is reported instead of invented. Review inferred steps and teach browser nodes before replay. `SCREENPIPE_DISCOVERY_OUTPUT_DIR` can override the final-answer directory if Screenpipe uses a nonstandard local location.

The local token is read only by Electron main. Do not prefix secrets with `VITE_`. Screenpipe and the backend use their own AI configurations; configuring one does not configure the other. The backend sends the final discovery answer and request to its configured OpenAI model for formatting. Ghost does not send raw recordings to that formatter.

## Configuration reference

| File / variable | Purpose |
| --- | --- |
| Root `.env`: `VITE_GHOST_DISCOVERY_MODE` | `prepared` (default local demo) or `live` (Screenpipe/backend); restart or rebuild after changing |
| Root `.env`: `GHOST_BACKEND_URL` | Desktop API origin; default `http://127.0.0.1:3001` |
| Root `.env`: `SCREENPIPE_LOCAL_API_URL`, `SCREENPIPE_LOCAL_API_KEY` | Local Screenpipe connection |
| Root `.env`: `POSTGRES_*`, `BACKEND_PORT`, `FRONTEND_PORT`, `DEMO_WEBSITES_PORT` | Docker Compose settings; demo port defaults to 3100 (`FIXTURES_PORT` remains a fallback for existing configurations) |
| `backend/.env`: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Locally launched API database and AI configuration |
| Root `.env`: `OPENAI_API_KEY`, `OPENAI_MODEL` | Used by the **containerized** backend; Compose does not read `backend/.env` |

The root and backend environment files are separate and ignored by Git. The `.env.example` files contain local defaults, not working personal credentials. If you change the API's published port, update `GHOST_BACKEND_URL` too.

## Optional: all supporting services in Docker

Instead of running the backend and websites in separate Node terminals:

```sh
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 180
docker compose ps -a
```

This starts PostgreSQL (5433), migration job, backend (3001), demo websites (3100), and a **renderer-only preview** (8080). The migration container exiting successfully is expected. Run `npm run dev` on the host for the actual Electron app. Stop local servers on the same ports before starting the full stack.

```sh
node scripts/check-docker.mjs
docker compose logs --tail=80 migrate backend demo-websites
docker compose down
```

The smoke check creates and deletes one disposable API workflow. `docker compose down` retains the database volume. Do not add `--volumes` unless you intend to erase that database. The API currently has no general user authentication; Compose binds exposed services to localhost.

## Verification

Run commands from the repository root after installing the relevant project's dependencies:

```sh
# Desktop compilation and local engine checks
npm run build
npm test
npm run test:processing
node scripts/check-nova-logic.mjs
node scripts/check-prelearned-unit.mjs
node scripts/check-results.mjs
node scripts/check-workflow-scripts.mjs

# Demo websites
npm --prefix demo-websites run build
node demo-websites/scripts/check-restocking.mjs

# API: requires DATABASE_URL and a reachable PostgreSQL server
npm --prefix backend run build
npm --prefix backend test
```

Backend integration tests create and remove isolated test schemas; the database user needs those permissions. Graphical Electron checks live in `scripts/` and `demo-websites/scripts/`. For example, after building Ghost, `node scripts/check-prelearned-browser.mjs` exercises the hosted NOVA browser recording in an isolated profile; use `GHOST_TEACH_SCENARIO=forma` for Forma. These need network access and a desktop session. Avoid concurrent tests sharing fixed debugging ports.

Generated regression reports go to ignored `out/test-results/` or temporary profiles. The macOS reliability suite has previously stalled at `Native select did not change`; do not treat the whole browser suite as proven by unit checks alone.

## Troubleshooting

- **API unavailable:** start the backend, check `/health`, and confirm PostgreSQL and `DATABASE_URL`. Prepared workflows still use local storage; they will not appear in live mode's backend list.
- **Screenpipe authentication error:** obtain its local token, update root `.env`, and fully restart Ghost. A healthy `/health` alone does not verify authenticated recording access.
- **Pipe fails with `toToolDeclaration is not a function`:** this setup encountered an incompatible `pi-subagents` extension. Back up Screenpipe's `~/.screenpipe/pi-config/settings.json` and disable its `npm:pi-subagents` package entry, or install a version compatible with Screenpipe's bundled Pi runtime. Ghost discovery does not require that extension.
- **Empty discovery:** confirm the selected local time range actually contains the task and Screenpipe was recording. Page visibility alone does not establish clicks or typed values.
- **Demo replay fails:** check the hosted website is reachable, inspect the reported action, and re-teach if the page changed. Only the exact bundled hosted NOVA/Forma tasks are automatically prepared.
- **NOVA delivery fails:** the complete runner expects the configured demo Slack workspace. Use the browser-only test to review exports without invoking delivery.
- **Stale styles:** stop Ghost, remove `node_modules/.vite`, and restart. Keep the profile's Local Storage, recordings, and cookies to preserve your data.
- **Linux rendering problems:** software rendering is enabled by default on Linux. `GHOST_SOFTWARE_RENDERING=1` enables it elsewhere; `0` opts back into acceleration. Keep Chromium's sandbox enabled.

## Repository and data layout

```text
src/main/          Electron, recorder/replay, processing, NOVA runtime, file storage
src/preload/       Allowlisted IPC bridge
src/renderer/      React UI, React Flow editor, themes and assets
src/shared/        Shared contracts and validation
backend/           Fastify API, Prisma schema/migrations, backend tests
demo-websites/     Next.js NOVA/Forma websites and their checks
screenpipe/        Ghost's discovery Pipe instructions
scripts/           Desktop/runtime validation and setup scripts
examples/          Sample processing workflow used by regression checks
docker/            Web-preview proxy configuration
```

Prepared workflows live in the desktop profile's local storage; live workflows live in PostgreSQL. Recordings, encrypted login data, downloads, processing outputs, workflow scripts, and NOVA run journals live under Electron's `ghost-desktop` user-data directory (on macOS: `~/Library/Application Support/ghost-desktop`). Browser data is separate from the PostgreSQL database.

Generated workflow scripts are versioned runtime-bound modules, not independent CLI executables. The NOVA runner executes its supported operations through trusted adapters; arbitrary graph execution and arbitrary third-party integrations are not implemented. General browser automation depends on teachable, verifiable page behavior. Local scheduling requires an open app. Team content includes demonstration data.

The UI supports Light, Dark, and System appearance. Asset attribution and licenses remain alongside active images in `src/renderer/src/assets/` and `demo-websites/public/nova/`.
