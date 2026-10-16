# Ghost — Implemented Features and Current Capabilities

**Updated: October 16, 2026**
**Scope:** The current repository, including the uncommitted NOVA test website. This is an implementation inventory, not a claim that every feature works on every website.

Ghost is a desktop workflow application that combines a saved workflow graph, a browser teaching/replay engine, and local data processing. Workflow definitions live in the backend; browser sessions, recordings, execution artifacts and schedules are primarily device-local.

## 1. Platform architecture

| Layer | Implementation |
| --- | --- |
| Desktop | Electron, TypeScript, Electron Vite |
| UI | React, TypeScript, React Router, shared styles and image assets |
| Embedded browser | Electron `WebContentsView`, persistent Chromium session |
| Browser automation | Recorder preload, IPC bridge, live DOM inspection and Chromium DevTools Protocol (CDP) |
| Backend | Node.js, strict TypeScript, Fastify, Zod |
| Database | PostgreSQL, Prisma schema, migrations and reusable client |
| API documentation | Swagger/OpenAPI and Swagger UI at `/docs` |
| Local processing | Validated processing operations, worker execution, CSV and Excel libraries |
| Test websites | Next.js app in `tests/`, with Forma and NOVA |

The desktop renderer communicates with privileged operations through the preload/IPC bridge. The application does not replace Chromium with an AI-controlled browser.

## 2. Home page and workflow discovery

Implemented UI and behavior:

- A redesigned home page with a workflow request input, application imagery and workflow cards.
- Lightweight input placeholder rather than a prefilled example request.
- Removed attachment-context controls and the interactive Screenpipe picker; simplified the source presentation.
- Removed the home-page “How it works” section.
- Backend-backed saved workflow listing, refresh, loading, empty and error states.
- A generating card and progress stages while a new workflow is being created.
- Workflow-related application imagery, including Chrome imagery for browser tasks.
- Original user input and system instructions remain separate.
- Structured high-level discovery descriptions: workflow name, steps, applications, starting URLs where available, evidence/missing information and configuration needs.
- Browser interaction details are captured during teaching rather than invented by discovery.

### Current discovery implementation

The development flow is:

1. Submit the user's request.
2. The mock preparation endpoint waits approximately five seconds.
3. OpenAI simulates a high-level activity/workflow response from the request.
4. Ghost validates and saves a workflow graph in the backend.
5. The saved graph appears in the workflow list and can be opened in the editor.

**This is simulated discovery, not analysis of real Screenpipe recordings.** The mock/generation endpoints are disabled in production mode. A configured server-side OpenAI key is needed for AI generation. The generation endpoint rejects a duplicate request ID while that request is running.

## 3. Workflow management and canvas

- A separate workflow page, retaining the application sidebar.
- Backend workflow create, list, retrieve, update and delete operations.
- Saved workflow names, descriptions, status, nodes, edges and node positions.
- Interactive workflow canvas with node selection and canvas navigation controls.
- Node configuration in centered dialogs rather than a permanent inspector sidebar.
- Application-specific imagery on nodes and workflow cards.
- Browser starting URL and task instructions configurable for browser steps.
- A complete browser task can be represented by one browser node, then taught as one recording.
- Draft, active and archived workflow statuses in the backend schema.
- Workflow deletion integrated with local schedule removal.
- Scoped node contracts for expected inputs, outputs and configuration requirements.
- Data-processing and runtime-logic inspectors integrated into the existing editor.

A node's visual presence does not mean its external integration is executable. Browser steps and local processing have implemented execution paths; other application-specific steps can still require configuration or an integration that is not implemented.

## 4. Browser teaching workspace

- Embedded website occupying the main recording workspace.
- URL/address input, including normalization of supported addresses and search/navigation handling.
- Back, forward, reload and stop controls.
- Loading and navigation error feedback.
- Persistent Electron browser session for cookies and permitted signed-in sessions.
- Start, pause, resume and stop recording controls.
- Recorded activity timeline and inspectable event details.
- Browser interaction diagnostics: focus, visibility, native-view bounds and capture readiness.
- Browser viewport resizing and expanded workspace controls.
- New-recording action for replacing a browser task deliberately.

### Native browser/dialog overlap fix

Electron's native browser view cannot be covered reliably by renderer CSS alone. Dialogs now acquire a main-process modal hold and wait for the browser view to detach before appearing. Resize/bounds updates cannot reveal it while a modal is active. Closing the dialog restores the view without reloading the website.

## 5. Recording capture

The recorder captures supported interactions and useful context:

- Navigation and supported frame navigation.
- Clicks and pointer metadata.
- Input changes, textareas, checkboxes/radios and native select values.
- Supported contenteditable interactions.
- Relevant keyboard events, including Tab and select-all/replacement workflows.
- Scroll changes with stop-time flushing.
- Download initiation and completion.
- Focus outcomes and observable page-state evidence.
- Unsupported events retained as explicit blockers where applicable.

Target information includes stable IDs, test IDs, role/name, labels, placeholders, text, CSS fallback, surrounding context, frame identity and geometry where available. Recorded pointer information is useful for diagnostics and strict background hit testing; it is not a license to click arbitrary screen coordinates.

Event planning consolidates repeated input/change events and supported native-select completion. Submission/click deduplication follows recorded causality. Unsupported-action blockers survive planning and input overrides.

## 6. Saved steps, inputs and passwords

- Stopping a meaningful recording associates it with its workflow and node.
- Reopening that step restores the same recording in the stopped state.
- Saved actions and edited input overrides survive an application restart.
- Reopened steps use the recording's starting URL rather than an unrelated default website.
- Password/passcode inputs are encrypted locally using AES-256-GCM.
- The masked input editor indicates whether a secret is saved; an empty replacement preserves the existing encrypted value.
- Replay decrypts saved values when needed for insertion and verification.
- Duplicate captures of the same ordinary field/value do not restore the original text over an edited override, including when React changes element IDs.
- Empty replacement recordings do not overwrite the saved node reference.
- Existing recording files remain on disk when a replacement is created.

### Backend input backup

The current code also implements encrypted recording/input backup through `/api/recording-secrets`:

- Payloads are encrypted before upload; the desktop encryption key is not uploaded.
- Access uses a recording-specific capability token, stored as a hash on the backend.
- Sync state is persisted locally.
- Replay can use the encrypted backend backup with local fallback.
- Credential sync requires HTTPS for a remote backend; local HTTP is allowed for development.

This is not full user-account authentication or portable cross-device password recovery. Decryption depends on the device-local key. Lost keys, changed passwords, expired verification codes and provider-specific authentication may still require intervention.

## 7. Verified browser replay

The executor checks state before and after each supported action:

1. Confirm cancellation state, page, viewport visibility and readiness.
2. Resolve the live target with ranked locators.
3. Require a unique, visible, available target.
4. Check that a supported observable postcondition exists.
5. Persist dispatch intent before sending the action.
6. Execute with the existing CDP/native input mechanisms where applicable.
7. Wait for an observable result and persist the result/checkpoint.

Supported verification includes field values, checkbox/radio states, selected dropdown options, navigation destinations, recorded focus destinations, dialog/status/ARIA evidence, scroll positions and downloads.

Native text insertion is followed by value checks. Existing correct values can avoid unnecessary mutation. Ambiguous targets stop replay. A successful CDP dispatch is not sufficient to mark an action verified.

### Recovery and execution status

- Bounded locator and postcondition polling tolerates transient rendering/navigation changes.
- Read-only observation checks whether an action already took effect.
- Non-idempotent operations are not blindly retried when their outcome is uncertain.
- Scroll has a bounded retry path; clicks/submissions are not generically retried.
- Explicit result states include pending, running, verified, failed, skipped, unknown and needs approval.
- Run authorization covers the recorded actions for that run; a per-action approval path also exists.
- Cancellation stops further dispatch and retains uncertainty when an action might already have occurred.

Diagnostics distinguish `TARGET_NOT_FOUND`, `TARGET_AMBIGUOUS`, `ACTION_UNSUPPORTED`, `EXECUTION_FAILED`, `VERIFICATION_TIMEOUT`, `OUTCOME_UNKNOWN`, `RESUME_REJECTED` and `CANCELLED`.

### Checkpoints and safe resume

The local replay journal stores workflow/recording identity, plan hash, current action index, last verified checkpoint, action results, sanitized page identity and failures. Writes are ordered and atomic.

**Revalidate and resume** checks the same plan, URL and browser document. If an action may already have executed, resume verifies its result rather than dispatching it again. Reloaded documents and interrupted downloads can require manual review.

Reopening a saved recording after restart and running it from the beginning is supported. Automatically resuming an interrupted run in a new browser document is not.

## 8. Fast and slow demo replay

- **Start test · Fast:** normal replay speed with state-based waits.
- **Demo replay · Slow + highlights:** pauses at targets, shows a yellow outline/action marker and leaves time to see each step.
- Highlight overlays do not intercept page clicks.
- Targets are revalidated after the visual pause.
- Cancellation remains available during the pauses.
- Both modes execute the same real workflow actions and retain verification.

## 9. Run results and downloaded files

- An automatic results dialog after successful replay.
- A **View run results** action for inspecting available run outcomes.
- Verified-action counts, duration, file counts and individual action evidence.
- Download names, sizes, state and originating action.
- Inline previews for supported small CSV, text, JSON and log files.
- **Show in folder** and **Open saved run folder** controls.
- Separate persisted reports and downloads for repeated runs.
- Download verification checks completion, filename, MIME type and file byte count on disk.
- Main-process file access checks keep previews/reveal operations scoped to the recording's registered files.

Files are saved, not automatically installed or executed. Download verification does not certify the business correctness of a file's contents. Large files and unsupported preview formats remain accessible through the saved folder.

## 10. Browser outputs for downstream nodes

Browser output configuration supports captured downloads and configured page extraction:

- Text from a uniquely resolved selector.
- JSON parsed from a configured page element.
- Structured rows from a configured HTML table.
- Registered local file artifacts from verified browser runs.

Extraction enforces limits and validates table headers and row shape. Downstream processing consumes verified outputs, not arbitrary renderer-supplied filesystem paths. Changed or stale upstream outputs can invalidate processing context.

## 11. Deterministic data-processing nodes

Typed node values include files, rows, text, JSON, numbers and booleans. Input mappings reference upstream nodes and named outputs, with graph/type validation and cycle checks.

Implemented manual operations:

| Operation | Purpose |
| --- | --- |
| Read Excel / CSV | Read supported tabular files, optionally choosing a worksheet |
| Merge files | Combine supported file data |
| Filter rows | Apply explicit comparison predicates with all/any matching |
| Transform columns | Map/rename fields and convert, trim or change text case |
| Compare datasets | Compare rows by configured keys |
| Find duplicates | Identify duplicate records by keys |
| Detect missing records | Compare against expected IDs or reference data |
| Aggregate totals | Count, sum, average, minimum and maximum with grouping |
| Generate reports | Write XLSX, CSV or JSON artifacts |
| Conditional logic | Evaluate configured predicates and return matching results |

Processing produces real output files and row counts. File registration, content checks, schema validation, file/row limits and worker execution constrain what can run. CSV output includes formula-injection escaping. Example graph: [`examples/transaction-processing.workflow.json`](../examples/transaction-processing.workflow.json).

## 12. AI-assisted processing logic

This is separate from browser automation:

1. Resolve real verified upstream outputs.
2. Inspect their schemas and supported file structures locally.
3. Review what schema information will be shared; samples are optional.
4. Explicitly consent to generation through the backend/OpenAI.
5. Generate a constrained processing plan.
6. Review and test the plan against actual inputs.
7. Approve it for subsequent execution.

Plans support defined operations such as selection, renaming, transformation, filtering, merge/join, aggregation, duplicate detection, comparison and output generation. They are validated structured plans, not unrestricted AI-generated scripts.

Changed objectives, bindings, expected outputs, upstream configuration, file contents or browser-run identities can require inspection and testing again. The UI exposes waiting-for-input, generation/review, execution progress and failure details.

## 13. Local workflow scheduling

- Run-now controls for the supported local processing runner.
- Future start times and one-time/hourly/daily/weekly schedules.
- Persisted schedule list, last-run time and result.
- Per-workflow protection against overlapping executions.
- Missed intervals are skipped rather than replaying a backlog.
- Schedule removal and integration with workflow deletion.

**Current execution scope matters:** the scheduler runs local processing against available verified browser outputs. It does not automatically launch and replay every browser node. Workflows without processing nodes are directed to the browser recording path. Unsupported node types stop the scheduled run. Scheduling requires the desktop application to be running; it is not a cloud scheduler.

## 14. Backend and database

Implemented foundation:

- Fastify API with CORS, logging, centralized errors and a health endpoint.
- Zod request/configuration validation.
- Prisma generation, migrations and database scripts.
- PostgreSQL local development through Docker Compose.
- UUID identities, timestamps, enums, indexes and relational constraints.
- Models: `User`, `Workflow`, `WorkflowNode`, `WorkflowEdge`, `WorkflowRun`, `NodeRun`, `RecordingSecret`.
- Swagger/OpenAPI documentation setup.
- Environment examples without real credentials.

Primary routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health |
| GET / POST | `/api/workflows` | List/create workflows |
| GET / PATCH / DELETE | `/api/workflows/:id` | Retrieve/update/delete workflow |
| POST | `/api/workflows/:id/contracts` | Define node contracts |
| POST | `/api/workflow-discovery/prepare` | Prepare discovery request |
| POST | `/api/workflow-discovery/mock` | Delayed development simulation preparation |
| POST | `/api/workflow-discovery/generate` | Generate and save simulated workflow |
| POST | `/api/workflows/nodes/generate-logic` | Generate constrained processing logic |
| POST | `/api/workflows/nodes/approve-logic` | Approve processing logic |
| GET / POST / DELETE | `/api/recording-secrets` | Capability-scoped encrypted backup |

Database run models provide a persistence foundation; their existence does not mean every desktop run report is synchronized into them. General authentication, account management, production tenancy and full authorization are not implemented by the workflow CRUD foundation.

## 15. Forma test website

Location: `tests/`, normally served at `http://127.0.0.1:3100`.

- Login page and demo session.
- Finance dashboard with payment/invoice records, filters and CSV export.
- Customer/user dashboard, customer creation and saved edits.
- Light/dark theme support.
- Responsive layouts and browser-local persistence.
- Stable labels/test IDs and native controls for recording.
- Root URL behavior and return-to-page login routing.

Demo login: `demo@forma.test` / `ghost-demo`. These are fixture credentials, not production accounts.

## 16. NOVA test store

NOVA is the second website in the same Next.js app, available at `/nova` with login at `/nova/login`. It has separate local storage and demo session state from Forma.

Implemented pages/features:

- Reference-inspired dark sidebar/topbar and light store dashboard.
- Product photography generated locally and saved under `tests/public/nova/products.png`.
- Sales/order/item metrics and sales bars derived from sample orders.
- Recent orders, product totals, customer locations and task shortcuts.
- Order search/status filters, order details, internal notes, status changes and bulk fulfillment of paid orders.
- CSV exports for orders, products and customers.
- Product catalog with editable prices and stock.
- Original unit prices retained in order totals when catalog prices change.
- Customer directory and links to order history.
- Campaign drafts, discount-code creation and store-announcement editing.
- Store settings, sign-out, reset-demo-data control and separate NOVA login.
- Responsive sidebar/navigation and table layouts.
- Native controls, stable IDs, semantic dialogs and visible success feedback for recording.

Demo login: `alex@nova.test` / `nova-demo`.

NOVA is a functional local fixture, not a live commerce integration. It does not charge cards, send campaigns or manage a real Shopify store. Reviews and subscription pages show their empty/demo state. Reporting dates use the October 2026 sample dataset. The map/sparklines are illustrative and lifetime product totals are labeled as seeded data.

**Verification status:** NOVA builds and typechecks. Its browser test exercised login, filtered CSV exports, persistent order/inventory edits, campaign creation and customers. It then found a mobile chart/layout overflow; a CSS fix was applied, but the final responsive rerun was interrupted. Do not describe the full NOVA UI suite or Ghost end-to-end recording/replay against NOVA as passed yet.

## 17. Storage responsibilities

| Data | Location |
| --- | --- |
| Workflow graph and configuration | PostgreSQL backend |
| Recording events/metadata and local overrides | Desktop user-data recording directory |
| Recording-to-node association | Local saved-node references |
| Encryption key | Device-local restricted-permission key file |
| Encrypted input backup | Backend recording-secret storage |
| Cookies/browser session | Electron persistent browser session |
| Replay checkpoints and per-run reports | Local recording files |
| Downloaded and processed files | Local artifact directories |
| Workflow schedules | Local schedule JSON |
| Forma/NOVA fixture edits | Their separate browser localStorage keys |

Exports contain recording configuration and encrypted secret data, not ordinary plaintext password fields. This is not a complete cross-device sync or disaster-recovery system.

## 18. Testing and evidence

Available commands/scripts include:

```sh
npm test
npm run typecheck
npm run build
npm run test:electron
npm run test:resilience
npm run test:processing
npm run test:processing:electron
npm run test:runtime-logic
npm run test:runtime-logic:electron
npm run test:browser-settings
node scripts/check-workflow-scheduler.mjs
node scripts/check-demo-replay.mjs
node scripts/check-downloads.mjs
node scripts/check-encrypted-recording.mjs
npm --prefix backend run build
npm --prefix backend test
npm --prefix tests run typecheck
npm --prefix tests run build
```

Electron tests require a supported graphical/headless environment; database integration tests require their configured test database. Some scripts require the fixture web server running first. A script being present is not evidence that it passed in every environment.

Previously recorded browser reliability evidence includes 20 successful runs on each of three local fixtures and 20 on each Forma dashboard (100 total), nine recovery scenarios, and 18 negative/failure checks. These are dated results, not a fresh execution of those suites for this documentation update. See the JSON reports and [`replay-resilience.md`](replay-resilience.md).

Later targeted checks covered slow demo mode, cancellation, saved downloads/results, app-restart credential reuse, and modal/native-view visibility. Processing tests covered real CSV/XLSX/JSON outputs, graph mappings, schema changes, and invalid files/references. See the corresponding scripts for exact assertions.

## 19. What is not implemented or not generally guaranteed

- Real Screenpipe activity discovery and Screenpipe-driven Slack/email execution.
- Arbitrary AI browser control.
- Universal website compatibility, authentication bypass or Google OAuth bypass.
- General replay of popups, dragging, arbitrary native context menus or closed shadow DOM.
- Reliable resume after a browser document reload or across app restart.
- Automatic browser replay as part of every scheduled workflow.
- Production user authentication, tenant isolation, cloud scheduling or full cross-device sync.
- Real payments, messaging or commerce services in the test websites.
- Business-success verification beyond the actual recorded/captured evidence.

Some native-select context gestures consolidate into verified selections; that does not make all context menus supported. Supported frame handling requires identifiable frames and usable geometry. Older recordings without adequate outcome evidence may need re-recording.

## 20. Main implementation references

- Desktop lifecycle and IPC: `src/main/index.ts`, `src/preload/index.ts`.
- Browser lifecycle: `src/main/teachingBrowser.ts`, `src/main/frameBridge.ts`.
- Capture and DOM resolution: `src/preload/recorder.ts`, `src/shared/pageOperation.ts`.
- Planning/replay: `src/main/prepareReplay.ts`, `replayPlan.ts`, `replaySettings.ts`, `replayRecording.ts`, `replayDiagnostics.ts`.
- Recording/credential persistence: `src/main/recordingStore.ts`, `recordingSecrets.ts`, `recordingSecretsBackend.ts`.
- Processing: `src/main/dataProcessing/`, `backend/src/contracts/`.
- Scheduling: `src/main/workflowScheduler.ts`.
- UI: `src/renderer/src/pages/`, processing inspectors, `ReplaySummary.tsx`, `DashboardDialog.tsx`.
- Backend routes/services: `backend/src/modules/`; database schema: `backend/prisma/schema.prisma`.
- Fixture apps: `tests/app/`, `tests/components/`, `tests/components/nova/`.

Related documentation: [`recording-and-replay-explained.md`](recording-and-replay-explained.md), [`replay-resilience.md`](replay-resilience.md), [`backend/README.md`](../backend/README.md), [`tests/README.md`](../tests/README.md).
