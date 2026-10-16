# Recording and replay reliability changes

This is the current implementation report. The earlier `recording-and-replay-review.md` is a historical review of the prototype, not a description of the corrected code.

## Root causes and changes

| Root cause | Change |
| --- | --- |
| Planning a previously filtered log lost drag/popup blockers | `prepareReplay` applies validated overrides to the complete original log, then plans once. Real IPC preview/start regression cases cover the blockers. |
| A single structural selector could address the wrong element | Shared `pageOperation` records and resolves stable/test IDs, accessible role/name, associated labels, placeholders, names, text and container context. Generated-looking IDs are not preferred. Ambiguous candidates stop the run. |
| Labels included textarea/select contents | Label extraction removes editable controls from the label clone. Typing no longer changes the recorded field name. |
| Native view and desktop focus could race after a modal | Bounds/visibility diagnostics are exposed in Console. Replay uses targeted Chromium input and temporary focus emulation; it still requires a visible, non-minimized browser viewport. Focus emulation is removed and the debugger detached on termination. |
| Property assignment did not reliably enter text into controlled editors | Standard input, textarea and contenteditable replacement uses selection plus Chromium `Input.insertText`; the resulting value is checked. Checkbox/radio changes use targeted clicks only when state differs. Native selects use the option state API plus events and verify selected values. |
| Fixed sleeps were counted as success | Bounded polling waits for target readiness, expected destination, value, selection, scroll offset and recorded outcome evidence. Cancellation is checked while waiting. |
| An emitted click was counted as success | Actions have pending/running/verified/failed/skipped/unknown/needs-user-approval states. Observable outcome evidence is recorded and verified. Unknown outcomes stop without retries. |
| Generic submit timing could duplicate or lose submissions | Captured submit events refer to the actual preceding trigger/form via an action ID. Unlinked submissions block replay. Select and checkbox input/change events are coalesced without a second toggle. |
| Final debounced scroll was dropped | Stop/pause flush all pending scroll targets before acknowledgement. Main waits for acknowledgement and reports a timeout instead of silently declaring success. Text inputs are emitted immediately, with no unused debounce queue. |
| Text typed during Pause could be captured later on blur | Paused field fingerprints suppress a deferred change event until the field actually changes after resuming. Sensitive values are not kept in those fingerprints. |
| Page metadata could precede recorder enablement | Page readiness is reported once capture is enabled. New recordings distinguish unused frames from frame entry; focus and pointer-entry guards report unsupported frame activity. |
| Exports omitted user input settings | Export version 2 includes original events plus saved non-sensitive input overrides. New recording metadata uses schema version 2; original logs are not rewritten. Older optional fields remain readable, but insufficient identity/evidence can stop old recordings safely. |
| Credentials could appear in fields/navigation | Attribute and associated-label masking covers recognized password, payment, token, PIN and authentication-code fields. Authentication query/fragment values are redacted and their recordings blocked. No secret vault or cookie transfer was added. |

## Execution lifecycle

1. Opening a teaching route creates the existing sandboxed `WebContentsView`, persistent website session and isolated recorder preload.
2. The recorder reports trusted actions, semantic identity and limited observable outcomes. Main validates the sender and appends JSONL.
3. Stop flushes pending observations, waits for acknowledgement, then finishes the recording.
4. Preview reads the full event log and saved input overrides. Unsupported operations remain in the blockers list.
5. Start test uses the existing browser view. It validates the initial destination, resolves each target afresh and waits for readiness.
6. General buttons and Enter actions require per-action approval. The dialog names the recorded action; approval is valid only for the pending sequence in this run. Denial/cancellation prevents dispatch.
7. Text, control state, navigation, scroll and recorded status/dialog/expanded-state effects are checked. No arbitrary AI matching, blind coordinate fallback or retry of a possibly completed operation occurs.
8. Per-action results appear in **Action results** and are saved in `last-replay.json`. Verified means the stated observable condition matched, not that a backend business transaction was independently audited.

The click point is the center of a uniquely identified live element after scrolling and hit testing. Screen coordinates from the recording are retained as evidence but do not determine the target.

[Electron's debugger transport](https://www.electronjs.org/docs/latest/api/debugger) carries the targeted [Chromium input commands](https://chromedevtools.github.io/devtools-protocol/tot/Input/). Playwright and external automation services were not introduced.

## Files

- `src/main/prepareReplay.ts`: common complete-log planning path used by IPC/tests.
- `src/main/replayPlan.ts`: blockers, causal deduplication, approval flags, recorded outcome association.
- `src/main/replayRecording.ts`: targeted execution, state-based waits, verification, approvals, cancellation and debugger cleanup.
- `src/main/teachingBrowser.ts`: integration, flush acknowledgement, safe diagnostics, approval IPC, navigation source and sensitive URL handling.
- `src/main/recordingStore.ts`: versioned metadata and complete exports.
- `src/shared/pageOperation.ts`: self-contained DOM identification, inspection and evidence verification shared by recorder/replay.
- `src/shared/recordedURL.ts`: authentication URL redaction.
- `src/shared/recording.ts`, `src/shared/browser.ts`, `src/preload/index.ts`: types and IPC bridge.
- `src/preload/recorder.ts`: semantic capture, outcome observations, pause/flush and unsupported-action reporting.
- `src/renderer/src/pages/RecordStep.tsx`, `src/renderer/src/styles/record-step.css`: approval/results/diagnostics inside the existing recording page.
- `scripts/core-tests.ts`, `scripts/check-core.mjs`, `scripts/check-replay-plan.mjs`: core regression coverage.
- `scripts/check-reliability.mjs`, `scripts/check-failures.mjs`, `scripts/fixtures/*`: real Electron local dashboards and failure cases.
- `package.json`, `package-lock.json`: test commands and an explicit dependency on the already-installed esbuild used for local fixtures.

`replaySettings.ts` was inspected and its validation is reused; it was not replaced. Existing Electron, React, TypeScript, IPC, workflow routes and `WebContentsView` architecture remain.

## Automated checks

```sh
npm test
npm run typecheck
npm run build
node scripts/check-browser-address.mjs
node scripts/check-reliability.mjs
node scripts/check-failures.mjs
```

`npm run test:electron` builds, then runs the positive and negative suites. The real Electron suites launch temporary profiles on debug ports 9230/9231 with fixture servers on 9340/9341. They use Linux X11 mode in this environment. A working graphical session is required. They do not sign into Slack or Google. Debug ports are test-only; do not use a personal authenticated profile for them.

The positive suite defaults to 20 complete record→stop→preview→override/export→approve→replay→verify runs per fixture. `GHOST_TEST_RUNS=1` is a smoke check, not the 20-run acceptance test. Dashboard A uses standard controls. B uses React-controlled fields, asynchronous menus and modals. C also changes layout/classes and includes repeated button text in a different container. Each recorded consent banner is already dismissed during replay. Final values and exactly one submission are asserted.

Executed results: the 20-run acceptance suite passed **A 20/20, B 20/20, C 20/20**. Subsequent approval/locator hardening was checked with the final failure suite and a separate final smoke run. Core regression tests, TypeScript, build and address validation also passed. Earlier failed development trials are not included in the successful counts.

The final failure suite passed **17 grouped checks**, including actual IPC blockers, modal/manual interaction, masking, pause/scroll flushing, ambiguity, unknown outcomes without retry, input-button approval, navigation and Ctrl+A. Forced renderer crashes, arbitrary third-party sites and native Wayland graphics behavior were not acceptance-tested.

Machine-readable results are in `reliability-test-results.json`, `reliability-failure-results.json` and `reliability-smoke-results.json`. A positive report is written only when all requested runs finish; an older report is not evidence that a later failed attempt passed. The final task response identifies which runs actually completed.

The negative suite covers empty recordings, pause/resume, last-scroll flushing, modal visibility and manual clicking, password/OTP masking, actual IPC rejection of frames/popups/dragging, missing/duplicate targets, changed initial state, redirects, unobserved results, cancellation and denied approval.

Historical scripts `check-action-recording.mjs`, `check-recording-replay.mjs`, `check-teaching-browser.mjs` and `check-provider-popup.mjs` are prototype diagnostics. Their assumptions about automatic button execution or one-click success predate per-action approval and are not the acceptance suite. Use the commands above for the corrected behavior.

## Remaining limits

- There is no claim of general Slack, Google or arbitrary-site reliability. Real authenticated third-party flows were not acceptance-tested.
- Popups as recorded task steps, drag/drop, modified/middle clicks, double-click/context-menu replay, downloads, and unsupported clipboard/keyboard shortcuts are blocked, not simulated. Unused frames do not block new main-page recordings. The frame bridge supports identified embedded frames with capture-ready recorders, but cross-origin readiness remains unreliable in the latest integration check (see below). Ambiguous or unavailable frames block replay. Old recordings without these guards keep their blockers and must be recorded again.
- Ctrl/Cmd+A is supported with selection verification. Other captured navigation keys need an observable recorded result; unsupported outcomes stop. This is not a complete keyboard macro engine.
- Native select state uses DOM selection/events rather than operating the operating-system popup menu. State is verified, but websites that require a different trusted-event sequence may reject it.
- Contenteditable replacement supports plain text. Complex rich-editor transactions, formatting, IME composition, nested/closed shadow roots and virtualized offscreen items may be unsupported.
- Outcome capture observes a bounded set of status/alert/dialog and expanded/pressed states. It is not a universal transaction oracle. Wait for the intended result before the next action or Stop; an intermediate spinner is not proof of business completion. Recordings without usable outcome evidence stop with an unknown result.
- Cookie optionality is a narrow English-label/context rule, with a bounded absence check. It does not grant new consent or solve arbitrary consent managers.
- Query parameter ordering is normalized; unexpected destinations or different parameter values stop the run. Credentials/session cookies are never copied between browser contexts.
- Authentication is manual and separate. Pause before entering credentials and record the task after login. Embedded Google OAuth restrictions are not bypassed. A failed or login-redirected run is not resumed automatically.
- Files are local plaintext with restrictive permissions; masking is heuristic. Do not use ordinary saved inputs as a credential store. There is no saved-session browser/import UI or global variable vault.
- Forced process termination can lose events not yet delivered. Stop and wait for confirmation before leaving. Linux software rendering remains a mitigation, not proof that all compositor failures are fixed; the verified graphical test mode is documented above.

## Manual verification

1. Fully close old Ghost instances and run `npm run build`. For the tested Linux graphics mode, launch `node_modules/.bin/electron . --ozone-platform=x11`; `npm start` uses the normal platform default.
2. Open **Workflows → a workflow → Needs teaching / Start recording**.
3. For authentication, **Pause** capture, sign in using a supported website flow, and start a fresh task recording after login. Do not include passwords or codes in ordinary inputs.
4. Enter a supported page address. In **Console → Check browser interaction**, confirm the viewport is visible, has nonzero bounds and reports capture readiness. Close Help, then verify ordinary manual clicking works.
5. Record a short task with labeled fields, a checkbox/select and a button that produces a visible status or dialog. Wait for the actual intended result before continuing.
6. Click **Stop recording**, then **Test recording**. Review blockers and edit the non-sensitive input values. Choose **Save inputs**, export JSON and confirm the export contains `inputs` alongside original `events`.
7. Start the test. Approve each specific button/Enter action only when appropriate. Inspect **Action results**; verified/skipped are distinct from failed/unknown.
8. Independently check the resulting website data. For a negative check, remove the intended target or duplicate it in a local test page: replay should stop before clicking an uncertain element. Cancel another test at its approval prompt and confirm nothing is submitted.

Do not retry a consequential action whose result is unknown without checking the website first.

## Historical frame-presence correction (2026-10-12, superseded by frame bridge)

The old implementation blocked every page containing an iframe, including unrelated embeds. New `page-ready` events declare `guarded-main-frame-v1`; their frame count alone is not a blocker. Main-page actions retain the same targeting and verification requirements. Entering a frame by focus or pointer remains unsupported, including same-origin frames. Pointer entry is conservative because wheel and hover activity inside a frame does not bubble to the recorder. It can block a task even when the pointer merely crosses an embed. No frame DOM contents or credentials are read.

Focus is checked on blur (immediately and next task), focus changes, resume and stop/flush. Old recordings keep their existing blockers because their missing frame activity cannot be reconstructed. Restart Ghost and make a fresh recording to use the correction. Unsupported messages now show the actual reason without the redundant “Unsupported action: unsupported” prefix.

Focused Electron check: `GHOST_TEST_FRAMES_ONLY=1 node scripts/check-failures.mjs` (after `npm run build`). It exercises unused static/dynamic frames, verified main-page replay, and same-origin/cross-origin frame-entry rejection through IPC, alongside the initial safety checks. Its report is separate from the historical full-suite report. During this change, full-suite attempts also encountered intermittent input-focus and drag-capture failures; those attempts are not passing full-suite results and this frame fix does not claim to resolve them.


## Frame bridge implementation and latest validation (2026-10-13)

The current implementation adds `frameBridge.ts` and sandboxed subframe recorders. It routes
recorded actions through frame identities, resolves native input coordinates through parent frames,
and retains blockers for ambiguous or unavailable frames. This supersedes the blanket frame-entry
rejection described in the historical section above. Recording schema version 3 preserves old blockers.

Pre-push validation: desktop and backend builds/typechecks, core tests, all 15 backend tests, and
`node scripts/check-discovery.mjs` passed. `node scripts/check-frames.mjs` passed three same-origin
iterations, then failed on the first cross-origin iteration because replay preview contained:
“The entered embedded frame is ambiguous or its recorder is unavailable. Wait for it to load and record again.”
The remaining nested-frame and failure checks were not reached in that invocation.
`frame-support-results.json` and `reliability-frame-results.json` are historical reports, not evidence
that the current full frame suite passed. The 20-repeat acceptance target remains unverified.


### Download and text-edit updates

New recordings capture download start/completion, link the file to a recorded triggering action, and save each file under a unique name in the recording directory’s downloads folder. Replay requires approval for the trigger and verifies completion, filename, MIME type and the on-disk byte count. This does not verify business contents. Missing, interrupted, unassociated or unexpected downloads stop replay; actions are not retried automatically. Pause/Stop waits for the user to finish an active download. Old unsupported-download events remain blockers.

Paste/cut/undo/redo shortcuts in editable non-sensitive fields use the captured resulting value, without reading the clipboard. A missing field result remains a blocker. Modified/non-left clicks and credentials remain unsupported. After manual login, Stop and choose New recording on this page; prior recordings are kept.

Validation: node scripts/check-downloads.mjs exercises actual Electron recording, download completion, preview, approval and verified replay using a local CSV endpoint. Core regression tests cover edit outcomes, absent outcomes, completed/incomplete/unassociated downloads and preserved legacy blockers.

### Manual authentication setup

Visible password/one-time-code inputs now suspend capture locally in the preload and pause the main-process recording. The recording UI shows a sign-in banner. After the user signs in and navigates to the task page, Start task recording creates a separate session from the current URL, preserving the authenticated browser partition and the earlier recording. Resume cannot accidentally continue the sign-in recording. Older blocked previews also offer Start clean recording on current page. Modified-click blockers identify the action sequence, target and modifier keys; they are not silently discarded.

Validated with `node scripts/check-auth-recording.mjs`: actual Electron automatic pause, excluded login values, current-page handoff and a new dashboard recording with no replay blockers. Detection is conservative and DOM-based; nonstandard authentication pages may still require manual pause.


## Saved login
Login settings on Record Step configure a login URL, exact signed-in URL, username,
and password for that workflow/node. Save and sign in pauses capture, enters
credentials using Chromium input, submits the unique standard form with
requestSubmit, and requires the configured destination with no visible password
field before proceeding. Start task recording on the dashboard afterward.
Replay performs this login prerequisite before task actions.

Remembered credentials use Electron safeStorage in a separate local vault.
Linux basic_text storage is rejected; when no secure keyring is available,
session-only credentials stay in memory until Ghost exits. Passwords are never
returned in login summaries or included in recording exports. Forget saved login
removes both the memory entry and encrypted file.

Supported: same-origin standard forms with one username/email, one password and
one submit button; HTTPS or loopback development URLs. Multi-stage OAuth,
cross-origin forms, click-only login handlers, MFA/CAPTCHA, frames and ambiguous
forms require separate support or manual authentication. Destination verification
does not prove general account authorization. No automatic submission retry occurs.
Old masked recordings cannot recover their passwords: configure Login settings
and record a clean task after sign-in.

Validation: core tests cover scope isolation, session-only storage, redacted
summaries, unavailable-keyring rejection, URL validation and deletion.
scripts/check-saved-login.mjs exercises real Electron saved login, capture,
preview, automatic login before verified replay, export exclusion and forgetting.
That test uses session-only storage; actual OS-keyring persistence is not covered
by the integration test.

## MVP update: direct encrypted input recording
The default flow now records sign-in in the same session as the task. There is no
Login settings button or automatic capture pause on password fields. Password
and passcode inputs travel over the isolated recorder IPC, are encrypted before
recording persistence or renderer publication, and are decrypted only during
input replay. Login form actions do not require a second approval prompt.

AES-256-GCM ciphertext uses a fresh nonce per value and is bound to the recording
ID and recorded URL. The device-local random 256-bit key lives in
recordings/.secrets/recording-key (0600, parent 0700). This MVP fallback needs no
OS keyring; someone with access to both that file and the recordings can decrypt
them. Exports contain ciphertext, never the key or plaintext secret.
Previous masked recordings cannot recover missing values; record them again.
One-time codes can be replayed as captured but may have expired.

Validation: npm test includes ciphertext tampering, context binding, reopening
the key, sanitized recording/export and replay planning. The real Electron test
scripts/check-encrypted-recording.mjs records login and a dashboard action,
previews, decrypts during native input replay and verifies the task outcome.

## Hackathon dashboard verification — 2026-10-13
Run against the real Next.js application at http://127.0.0.1:3100:
- npm run build
- npm test
- node scripts/check-next-replay.mjs
- GHOST_DEMO_PAGE=users node scripts/check-next-replay.mjs

The script captures real Chromium typing, login submission, a right-click on the
native status dropdown, keyboard selection and CSV export through Ghost's normal
recording IPC. It stops, previews, then replays the same recording twenty times.
Finance selects Paid; Users selects Active. It checks actual CSV files contain
the selected status and exclude the other statuses, checks a new download per run,
and alternates retained and cleared login state. Password plaintext is excluded
from the recording export. The run-level authorization used by Start test is
exercised and any unexpected per-action approval fails the test.

Fixes: consolidate select navigation keys and select contextmenu gestures into
the captured selectedValues when a corresponding selection exists. Unrelated
context menus are not silently dropped. Start test authorizes the recorded
actions for that run rather than asking again for each action; cancellation,
target matching, input verification and download completion checks remain.

Demo: open /login, record demo@forma.test / ghost-demo, sign in, select Paid on
Finance (or open Customers and select Active), Export CSV, wait for the completed
download, Stop recording, Test recording, Start test. Run the local Next server
with npm --prefix tests start. Restart Ghost after rebuilding to load the changes.

This verifies the login/filter/export demo on both dashboards, not arbitrary
website workflows, native menu item execution, or customer/payment mutation flows.

### Manual keyboard path
Inspection of session b4b60842-f80d-43ac-ab22-de2fd8056d8b showed that encrypted
password events were present, but replay stopped on event 27 (Tab from email)
before reaching them. Tab now verifies that focus leaves the recorded source.
Unnamed layout-container clicks with no recorded outcome or causal action are
omitted even when repeated or followed by submission, rather than being clicked
and failing outcome verification. Raw events remain available for inspection.

The Next.js regression now uses mouse clicks and character-by-character native
keyboard events, Tab from email to password, and repeated background clicks.
It asserts incremental encrypted password events exist and runs the full
login/filter/export workflow 20 times. This replaces the direct DOM-focus and
single insertText helper previously used for fixture login.
