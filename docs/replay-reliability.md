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
