# Replay resilience implementation

Updated 2026-10-13. This describes the current Electron/CDP implementation, not a guarantee for arbitrary websites. See the JSON result files in this directory for dated test evidence.

## Root causes corrected

- Electron collapsed exceptions from isolated-world DOM inspection into `Script failed`, hiding the difference between missing and ambiguous targets. Inspection now returns a result/error envelope.
- Changing surrounding text could invalidate an otherwise unique stable ID or test ID. Context now disambiguates weaker or duplicate candidates; visible duplicate targets still stop replay.
- Transient detached frames and destroyed execution contexts caused immediate failures. Bounded read-only polling now tolerates these navigation races.
- Some actions were dispatched before discovering that no verification handler existed. Unsupported postconditions now fail before dispatch.
- Tab checked only whether the source lost focus. New recordings capture the actual focus destination; older recordings infer it from the next actionable field when possible.
- Background clicks were previously omitted heuristically. They are now retained, captured with focus evidence, and hit-tested at the recorded relative position within the resolved container. Replay does not scroll a container away from that position. Clicking a child instead is rejected.
- Duplicate input/change events separated by scroll metadata could restore the original value over an edited override. Overrides now cover adjacent repeated captures of the same semantic field/value, including React ID changes. Conflicting replacements are rejected; separate edits remain separate.
- Replay status writes lacked durable dispatch intent and a resume contract. Ordered atomic checkpoints now precede dispatch and follow verification.

## Execution sequence

1. Check cancellation, browser visibility, focus, loading state and expected URL.
2. Resolve the live target using ranked locators. Stop on ambiguity; bounded polling can wait for an absent, disabled or covered target.
3. Check that a supported observable postcondition exists. Obtain recorded-action authorization where required.
4. Persist dispatch intent before sending the action.
5. Execute through existing CDP/native input mechanisms (native select values use DOM input/change events).
6. Wait for the recorded result. A dispatched command alone is never verification.
7. Persist the verified checkpoint, or retain a failed/unknown result with diagnostics.

Inputs verify exact values, checkbox/radio states or selected options. Text inputs use native Chromium insertion after selecting text and rechecking focus. Password values are decrypted only for insertion/comparison and remain encrypted on disk. Tab verifies its captured destination when available. Clicks verify navigation, focus, recorded status/dialog/ARIA evidence, or downloads. Downloads require completion plus matching name, MIME type and on-disk byte count. These observations do not prove an external business operation succeeded.

## Recovery and uncertainty

Locator resolution and postcondition checks retry only within bounded deadlines. Verification gets an additional bounded read-only observation period. Scroll is the only action automatically re-executed after a verification timeout, once; clicks, submissions, sends, deletes and text entry are not blindly repeated. Already-correct inputs need no mutation. An already-present result for a consequential action stops for inspection rather than repeating it.

`TARGET_NOT_FOUND`, `TARGET_AMBIGUOUS`, `ACTION_UNSUPPORTED` and `EXECUTION_FAILED` identify pre-dispatch failures. After possible dispatch, unresolved results become `OUTCOME_UNKNOWN`, with the underlying cause such as `VERIFICATION_TIMEOUT` retained. Cancellation can also leave an uncertain action. A late result found during final recovery establishes a verified checkpoint but pauses the run; resume continues from there.

## Checkpoints and resume

Each recording stores `last-replay.json` with workflow/recording IDs, a hash of the plan including overrides, current action index, last verified checkpoint, results, failure reason, sanitized URL and browser document identity (`performance.timeOrigin`). Writes are serialized and atomically renamed. Dispatch intent is persisted before side effects.

The recording screen offers **Revalidate and resume** after a recoverable stop. Resume requires the same plan, URL and live document. Before dispatching a previously unexecuted action it checks the last verified postcondition. If the interrupted action may already have executed, resume only checks its result; it never dispatches it again. If the result appears after intervention, execution can continue. Reloaded pages and interrupted downloads require manual review and are not automatically resumed.

This is continuation within the active teaching session. Checkpoints survive on disk, but reopening old recordings and resuming across an application restart is not implemented.

## Diagnostics and code map

Each result carries recorded/resolved target fingerprints and structural metadata, locator strategy, precondition, dispatch phase, verification phase, retry counts and failure codes. Values, credentials, selectors and accessible names are excluded from diagnostic target summaries. Use recording ID and event sequence to correlate them with the recording. The recording screen displays these details.

- `src/main/replayRecording.ts`: execution, observation, bounded recovery, resume checks.
- `src/main/replayDiagnostics.ts`: failure categories and sanitized target summaries.
- `src/shared/pageOperation.ts`: ranked live DOM resolution, hit testing and state inspection.
- `src/preload/recorder.ts`, `src/main/replayPlan.ts`: focus evidence and event consolidation.
- `src/main/replaySettings.ts`: repeated-field input overrides.
- `src/main/recordingStore.ts`: durable checkpoint journal and plan identity.
- `src/main/frameBridge.ts`: cancellation cleanup for frame requests.
- `src/main/teachingBrowser.ts`, preload/shared browser bridge, `RecordStep.tsx`: planning, persistence and resume UI.

## Verification commands

```sh
npm test
npm run build
GHOST_TEST_PLATFORM=headless node scripts/check-reliability.mjs
GHOST_TEST_PLATFORM=headless node scripts/check-resilience.mjs
GHOST_TEST_PLATFORM=headless node scripts/check-next-replay.mjs
GHOST_TEST_PLATFORM=headless GHOST_DEMO_PAGE=users node scripts/check-next-replay.mjs
node scripts/check-failures.mjs
```

The Next.js test application must already be running at `http://127.0.0.1:3100`. Tests use isolated temporary Electron profiles. The failure suite opens native popups; headless Chromium hung during that scenario in this environment, so that headless run is inconclusive, not passing.

## Manual verification

1. Start the local Next.js test app and Ghost. Open a browser node's teaching screen and navigate to `http://127.0.0.1:3100/login`.
2. Record entering the demo email, Tab to the password, enter the demo password, log in, change a dashboard filter and export CSV.
3. Stop. Check that the preview masks credentials and contains the intended actions. Edit a normal input and save it.
4. Start the test using test data. Check the actual filter and downloaded CSV as well as each action's verified evidence.
5. For recovery, use the local resilience fixture to remove a target before replay. Restore it in the same document after the run stops; select **Revalidate and resume**.
6. For ambiguous submissions, remove the confirmation while leaving the submit handler active. Verify that the run reports unknown and repeated resume attempts do not submit again. Add the expected confirmation and resume.
7. Reload the browser before resuming: continuation must be rejected. Cancel an active replay: it must stop without blindly repeating its last action.

## Limits

Old background clicks without observable evidence may require re-recording. Legacy Tab recordings without a destination still have weaker blur-only verification. Popups, arbitrary native context menus, dragging, closed shadow DOM and unresolved frame targets are not newly supported. Context gestures that only open a native select can consolidate into a verified final selection. State snapshots cover recorded observable DOM evidence, not every application-specific result. Changes to layout can invalidate a background point, and ambiguity deliberately stops replay. General website reliability requires broader validation than these local fixtures.

## Results from this change (2026-10-13)

- `npm test`: passed, including original planning blockers, encrypted inputs, background-action preservation, ordered checkpoints, plan-hash rejection and duplicate overrides with changing React IDs.
- `npm run typecheck` and `npm run build`: passed. `git diff --check`: clean.
- Standard dashboard A: **20/20**; dynamic React B: **20/20**; changed-layout C: **20/20**. The fixtures independently verify saved values and side-effect counts, not just executor status. See `reliability-test-results.json`.
- Actual Next.js finance: **20/20**; users: **20/20**, including native character typing, Tab, encrypted login, repeated visible background clicks, dropdown selection and CSV content checks. See `next-replay-finance-results.json` and `next-replay-users-results.json`.
- Recovery suite: **9/9 scenarios passed their expected assertions**. Initial outcomes were two completed, two `TARGET_NOT_FOUND`, one `TARGET_AMBIGUOUS`, two `OUTCOME_UNKNOWN`, one `CANCELLED`, and one `ACTION_UNSUPPORTED`. Tests additionally verify restoration/resume, no duplicate submission, and `RESUME_REJECTED` after reload. These expected stops are not successful workflow executions.
- Existing windowed failure suite: **18/18 checks passed**, including navigation, pause/resume, flush, credential masking, modal visibility, unused frames, preserved popup/drag blockers, cancellation and authorization denial.

Earlier attempts exposed and led to fixes for input overrides and invalid off-viewport fixture clicks. The headless native-popup attempt hung and is inconclusive; the full windowed run passed. The final repeated fixture suites had zero workflow failures across 100 successful runs. This does not imply every real website is supported.
