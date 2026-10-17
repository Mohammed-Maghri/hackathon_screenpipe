# Ghost → Screenpipe Pipe → saved workflow

Updated October 17, 2026.

## Implemented flow

1. Home submits the unchanged prompt, selected time range and request UUID through the existing preload/IPC bridge.
2. Electron checks for an already-saved workflow and obtains the canonical Ghost system prompt from `/api/workflow-discovery/prepare`.
3. Electron calls `POST /pipes/ghost-workflow-discovery/run` with `run_context`: request UUID, original prompt, selected range, exact ISO start/end bounds and system prompt.
4. Screenpipe's own Pi agent searches and analyzes history. The dedicated Pipe allows the recording summary/search APIs, denies mutation APIs, has no connected services, runs manually, and does not reuse conversation history.
5. Ghost polls execution metadata for the exact returned execution ID, with `include_output=false`. It never requests search, OCR, screenshots, frames, sessions, stdout or tool logs.
6. After Screenpipe reports completion, Ghost reads only `~/.screenpipe/pipes/ghost-workflow-discovery/output/<requestId>.json`, the Pipe's final deliverable. This file-based handoff is intentional: the execution detail API contains agent/tool logs as well as final text. Ghost rejects missing, oversized, malformed, symlinked files and mismatched request IDs.
7. Electron sends the final answer text to `POST /api/workflow-discovery/format`. The backend uses its existing OpenAI key/model to reformulate the answer into strict Ghost JSON, validates it, converts it using the existing graph builder and persists through the existing workflow service. Screenpipe can return its older JSON shape or prose; it no longer has to match the node schema itself. The original strict save endpoint remains for compatibility. Adjacent browser steps remain one recording node. Browser steps require recording; application steps require configuration.
8. Home opens the saved workflow board. Its Evidence tab labels references as agent-reported and lists missing information. Ghost does not invent evidence IDs or claim independent verification.

The plain `/v1/local/chat/completions` API is not used: it forwards messages to a model without a history-search tool loop. The former Ghost-managed retrieval code remains disconnected until real Pipe acceptance is complete.

## Setup on this laptop

1. Open Screenpipe and configure a working AI preset. The Pipe uses `preset: default`; select a specific preset in Screenpipe if needed.
2. Keep the local token in ignored root `.env`:
   ```dotenv
   SCREENPIPE_LOCAL_API_URL=http://localhost:3030
   SCREENPIPE_LOCAL_API_KEY=<local token>
   ```
   Obtain it with Screenpipe's supported `auth token` command. Never put it in the renderer or backend, or paste it into chat.
3. From the repository, run:
   ```sh
   npm run screenpipe:install
   ```
   This installs the dedicated manual Pipe through Screenpipe's API. It does not start a discovery or overwrite an existing Pipe. The source is `screenpipe/ghost-workflow-discovery/pipe.md`.
4. Start Ghost's backend and restart Electron. Enter a specific request and choose a range containing relevant recordings.
5. Watch generation, then review the automatically opened board, source references and missing information before recording browser steps.

If Screenpipe stores Pipes outside its default directory, set `SCREENPIPE_DISCOVERY_OUTPUT_DIR` in root `.env` to this Pipe's `output` directory and restart Ghost. This adapter currently supports Screenpipe on the same computer, not remote final-artifact fetching.

## Reliability and boundaries

- Screenpipe token stays in Electron. The backend receives the final answer and run provenance; the final answer and original request are sent to the backend-configured OpenAI model with store:false. OpenAI credentials remain server-side. No OCR, recording records or tool logs are sent by Ghost. Known sensitive patterns in the final answer are redacted before formatting.
- Ghost AI accepts final prose or JSON, including Screenpipe’s older evidenceIds format. Empty answers and explicit zero-step JSON do not trigger invented workflows. Structured source missingInformation is preserved even if the formatter omits it. Generated references and URLs must occur in the source answer. All generated claims remain unverified pending human review; these checks do not prove semantic equivalence. No simulated fallback exists.
- The final contract currently supports browser/application steps. Separate typed logic/review generation is not added by this integration.
- References are opaque agent-reported source identifiers/links, displayed as text. No independent retrieval verifies them. Missing references remain empty.
- Known sensitive patterns and unsafe URLs are rejected, but pattern checks do not guarantee detection of every secret. Screenpipe privacy controls still matter.
- A start-intent receipt is persisted before dispatch, then the returned execution ID is saved under Electron userData/screenpipe-discovery. A same-ID retry resumes polling or recovers a saved board. An interrupted/uncertain start stops rather than silently dispatching again. Receipts contain hashes/IDs, not prompts or recording contents.
- HTTP calls are bounded; overall waiting is six minutes. A Ghost timeout does not kill Screenpipe's agent. The Pipe has its own five-minute timeout. Retry the same Home request to recover its result.
- Home retains its request ID while retrying in the current session. After app restart, submitting a new prompt creates a new request; inspect Screenpipe first if the previous run outcome was uncertain.
- Pipe API permissions constrain Screenpipe API access. Discovery-only instructions are not an OS sandbox for an agent with filesystem/shell access. No integrations, schedules or automated business actions are enabled here.
- Existing workflows/recordings and the earlier backend endpoint remain compatible. No database migration is required.

## Verification

Live follow-up: after closing two competing Screenpipe instances and reopening one, installation succeeded. A real Pipe run completed and wrote valid final JSON. Its answer reported no capture in the requested last-24-hour range (most recent capture reported as October 10), so it returned zero steps. Ghost correctly saved no board. This verifies dispatch, execution tracking and final-file handoff; a nonempty live workflow-to-board result remains unverified. Ghost did not inspect raw records or tool logs to independently verify the agent’s search claims.

Results: all **70 backend tests passed**, including PostgreSQL final-answer persistence. Root core tests, desktop/backend TypeScript checks and builds passed. The Electron fixture test passed (Home → Pipe HTTP fixture → final file → Fastify → board, plus editor/reload/delete checks). These are not live Screenpipe AI acceptance results.

Automated coverage includes final-file-only flow, exact run matching, original prompt/time bounds, successful graph conversion, empty/malformed/missing answers, inference caveats, sensitive content rejection, offline/auth/409 failures, failed runs, uncertain start protection and save retry without a new run. `scripts/check-discovery.mjs` exercises real Electron Home/IPC and Fastify routes with a controlled Pipe HTTP/final-file fixture and database double.

Commands:
```sh
npm run build
npm --prefix backend run build
npm --prefix backend run typecheck
npm --prefix backend test
node scripts/check-discovery.mjs
```

## Source contracts checked

- [Screenpipe local chat](https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-engine/src/local_chat.rs)
- [Pipe run and metadata endpoints](https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-engine/src/pipes_api.rs)
- [Pipe configuration, status and execution types](https://github.com/screenpipe/screenpipe/blob/main/crates/screenpipe-core/src/pipes/mod.rs)

No commit or push.

## AI formatting follow-up

The real October 10 answer was rejected because it used the older Ghost shape (`evidenceIds`, `status`, and descriptive fields), while the Pipe importer expected `references`. The backend formatter now translates these formats. Live testing successfully reformatted that existing answer with the configured provider after correcting an unsupported JSON Schema URI format. Local Zod URL/UUID checks remain enforced. That isolated live formatter check did not save a user workflow.

Verification: full backend suite passed 79 tests before the provider-schema correction; all 25 targeted formatter/Pipe tests passed after it. Desktop/backend typechecks and builds passed. See the Electron fixture test for complete UI/IPC/formatter-route/save coverage with provider and database doubles.
