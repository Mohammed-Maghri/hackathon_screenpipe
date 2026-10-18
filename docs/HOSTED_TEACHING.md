# Hosted website teaching

Both prepared workflows use the hosted fixture origin, `https://hackathon-screenpipe.vercel.app`:

- NOVA: `/nova/restocking`
- Forma: `/finance`

Old prepared NOVA nodes with the exact port-3104 default migrate on load. Custom URLs are left unchanged. Previously captured recordings keep their original URLs and need teaching again; changing a node URL does not rewrite recorded history.

## Verification on October 17, 2026

Real Electron capture, planning and replay against the hosted websites passed:

- NOVA acceptance test: two successful replays, three completed files each (sales CSV, inventory CSV, shopping-list XLSX). A stock change changed the checked recommendation from 2 to 0.
- Forma saved-node teaching: one successful replay, one completed finance CSV; the recording store reported Learned.
- NOVA saved-node teaching: one successful replay, three completed files; the recording store reported Learned.

The two saved-node workflows reside in the isolated profile `/tmp/ghost-hosted-teaching-uD1DNV`. The existing open desktop profile was not stopped or modified. Local demo-site sign-in was performed while capture was paused; the taught tasks rely on that profile's signed-in browser session. No real payment, Slack send, or server-side record mutation was performed.

Reports are `hosted-teaching-forma.json` and `hosted-teaching-nova.json` in that profile. Downloaded files and recordings remain under its recordings directory. This temporary profile is not a portable credential backup.

## Repeating teaching

Build Ghost first, then run `node scripts/teach-hosted-workflows.mjs`. It defaults to NOVA in a new isolated profile. Set `GHOST_TEACH_SCENARIO=forma` for Forma. Set `GHOST_TEACH_PROFILE` to an existing profile only after closing the Ghost instance using it. The script selects the first matching prepared workflow, or creates one if none exists, records fresh browser exports, replays once, and checks the saved Learned status. It replaces the selected node's saved recording only after successful capture. Do not run concurrently against the same profile or debugging port.

These are browser export recordings, not a complete scheduler, report-processing runner or Slack integration.

## In-app automatic export teaching

On a signed-in hosted `/nova/restocking` or `/finance` page, start a new task recording and click **Perform exports & save recording**. Ghost resolves each known export button in the live DOM, checks uniqueness, visibility, enabled state and hit testing, sends native mouse down/up events, and waits for a captured completed download before continuing. NOVA exports sales, inventory and the shopping-list workbook; Forma exports the finance CSV using the current filters.

These are concrete, reviewed tasks for our own fixtures, not AI-generated arbitrary website control. The page must already be signed in: use the existing saved-login flow or sign in manually, then start a fresh task recording. Current dates, stock and filters are used without resetting them. NOVA itself calculates the shopping list.

The normal recorder captures the actual interactions, target identities and download evidence. Successful teaching stops and saves the recording against the current workflow/browser node. Click **Test recording** to replay through the existing verified engine; teaching alone does not mark the node Learned. Downloads and recordings remain in the normal local recording directory; passwords are not embedded in task scripts. The two explicit task definitions live in `src/shared/hostedBrowserTask.ts`, and the native interaction runner in `src/main/teachHostedTask.ts`.

Cancellation, an unexpected navigation, a missing/ambiguous/covered button or an unverified download stops the sequence. No dispatched export is automatically retried. If interrupted, inspect the captured partial task before testing or making a fresh recording. This feature does not execute Slack delivery or the entire workflow graph.

Validation: `node scripts/check-hosted-task.mjs` covers task selection, native dispatch counts, cancellation, ambiguity and navigation changes. `node scripts/teach-hosted-workflows.mjs` and `GHOST_TEACH_SCENARIO=forma node scripts/teach-hosted-workflows.mjs` use the actual in-app button, save the node recording and verify replay/artifacts in isolated Electron profiles.

## Pre-taught browser tasks (October 18)

New browser nodes pointing exactly to the hosted NOVA `/nova/restocking` or Forma `/finance` now receive a bundled, genuinely captured and replay-verified task automatically. The board prepares these recordings and shows **Learned**; opening the recording page also installs the task if necessary. No manual clicking/teaching is required for these two tasks.

- NOVA: start on the store home page, click Restocking, export sales CSV, inventory CSV and the reference Excel shopping list.
- Forma: start on Customers & users, click Finance overview, export the payments CSV.
- Before replay, the existing native sign-in flow uses the configured saved login, or the public fixture account displayed by our demo sites. This fallback is main-process-only, saved for the prepared browser node and restricted to the exact hosted origin/site section. Private credentials are not bundled.
- Replay uses fresh current website state and verifies navigation/download completion as before. No stock reset, new order, payment or Slack send is included.

The files in `src/main/prelearned/` contain recorded target identities, navigation, clicks and outcome evidence from actual successful runs. They contain no input fields, passwords, cookies, downloaded files or private browser profile. `teaching-source.json` records the original source recording, verification date and plan hash. Import does not manufacture a `last-replay.json` or copy old download artifacts. **Learned means verified reusable teaching, not a completed run in this new workflow.** The replay preview explains that distinction. A real run writes its own result and artifacts; a failed local run takes precedence over template verification for the status.

Existing saved recordings always win and are never replaced by this automatic installer. Concurrent preparation is deduplicated. Changed templates/plans cannot inherit the verified status. Edited/custom URLs and other websites are not automatically taught. Recreating a matching demo workflow gets a new node with the bundled teaching, while retaining the old workflow and its recordings.

Tests: `node scripts/check-prelearned-unit.mjs`; `node scripts/check-prelearned-browser.mjs`; `GHOST_TEACH_SCENARIO=forma node scripts/check-prelearned-browser.mjs`. Real Electron checks use isolated profiles and require a graphical session and hosted-site network access. They test fresh-session login, automatic import, navigation, download verification and the learned status. Restart the updated Ghost app to load the new main-process/preload code. Tests do not modify the user's normal profile.

October 18 verification evidence: navigation-inclusive source captures and verified replays passed for NOVA and Forma. Fresh-profile imported-task runs passed twice for NOVA (including return to the board showing Learned) and once for Forma, with 3 and 1 completed downloads respectively. An earlier fresh-profile NOVA attempt timed out before reporting replay completion; it is not counted as a pass. One earlier source-capture setup also failed at login. These hosted-site checks are a bounded demo verification, not a claim of general website reliability. Typecheck, build, core regression tests and the template-specific unit checks passed.

## Save at generation and retain login when re-teaching

Prepared workflow creation now awaits `prepareHosted` before publishing the workflow to local storage. A failed browser-task/login save returns an explicit generation error; it does not return a successful incomplete workflow. The board/open-time preparation remains an idempotent recovery path for older workflows.

The public demo login configuration is now saved encrypted under `recordings/.prepared-logins/`, keyed by workflow ID and browser node ID. It uses the existing device-local AES-GCM helper and restricted file permissions. This is separate from a recording ID, so replacing a recording keeps its login setup. Explicit user-saved login settings take precedence. Replay only uses the prepared fallback on the expected hosted origin and site section. No login configuration is sent to the renderer's workflow JSON or localStorage.

Re-recording keeps the same node and graph connections. A meaningful newly saved recording replaces that node's active action sequence; it does not append the old export clicks and accidentally download twice. Prior recording files remain available on disk. Empty recordings still do not replace the saved task. A new recording is Recorded until its own replay succeeds; it cannot inherit the original template's verification merely because it uses the same node.

Validation adds generation-before-publication and preparation-failure checks to `check-local-workflows.mjs`; encrypted login retention, replacement preservation, origin/workflow isolation to `check-prelearned-unit.mjs`; and an Electron replacement/reopen/session-clear/replay scenario in `check-reteach-prepared.mjs`.

Verification for generation-time saving: Home's NOVA/Forma generation UI test passed with zero backend/Screenpipe/AI requests; build, typecheck and core/unit regressions passed. The real Electron NOVA replacement test passed: imported task replay → New recording on this page → save new exports → close/reopen same node → remove isolated demo session → automatic login and replay → three verified downloads. Two earlier harness attempts were corrected (results overlay had not been closed; reopened document had not finished loading); neither was counted as a pass.

## Visible login-first playback

Opening a prepared saved browser node now opens its saved public demo login page. The replay preview names the login URL and explains that saved email/password entry and Sign in precede the recorded actions. Login progress is shown in the run status. Credentials are inserted through Chromium, checked inside the isolated page world without returning values, and submitted by a native CDP mouse click after unique visible button/hit-test checks. The signed-in destination is verified before task navigation begins. Slow demo mode adds a cancellable pause after each field; fast mode uses the same checks without those pauses. Existing authenticated sessions may skip login if a site's login route redirects to the verified destination; Ghost does not clear a user's session automatically.

The NOVA fresh-profile login-first run passed including all five login progress phases and three completed exports. An initial harness attempt started replay while the first page was still loading and failed; the harness now waits for that page to finish loading before pressing run.

Follow-up: readiness waiting is now enforced by the replay executor itself before authentication (visible window/view and completed initial navigation, with cancellation and a 20-second bound). The test-side readiness workaround was removed. Forma's fresh-profile login-first replay also passed, including native sign-in and its verified CSV download.

The startup investigation also found that initial replay status attempted to parse an empty browser URL before the first navigation committed, throwing before any checkpoint was written. Status now leaves that URL unset until available. `check-empty-browser-replay.mjs` covers this path and cancellation. The final immediate-start NOVA test passed all login phases and three downloads without a test-side readiness delay; core tests and build passed after the fix.
