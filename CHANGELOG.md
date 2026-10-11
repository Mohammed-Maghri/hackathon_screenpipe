# Ghost platform changes

## 0.1.0 — Initial platform, 2026-10-12

This first repository commit includes the desktop platform, workflow UI, native teaching browser, recording persistence, and browser replay reliability work.

### Desktop and dashboard

- Electron, React, TypeScript and Vite desktop application with bundled fonts and artwork, black/gold styling, welcome screen and custom window controls.
- Dashboard with automation prompt, workflow suggestions, search, filters, activity and connection panels, and library/settings dialogs.
- Shared navigation sidebar and separate Home, Workflows, workflow editor and recording routes.
- Local workflow drafts, template selection, validated JSON workflow import and JSON export. Draft/editor state survives route changes in memory but resets on app reload.
- Dashboard metrics, schedules, activity, discovery and integrations remain illustrative. No Screenpipe backend, AI workflow generation or cloud service is connected.

### Workflow editor

- Dedicated full-page editor retaining the sidebar and giving most workspace space to the canvas.
- Draggable nodes, background panning, zoom controls, fit-to-view, minimap and connection visualization.
- Centered node dialogs with editable descriptions, instructions and status, plus node creation, duplication and deletion.
- Workflow naming, export, readiness validation and collapsible preview logs.
- Needs teaching and Start recording open a separate recording page. Workflow-level Run remains a preview; actual browser replay is available from the recording page.

### Native teaching browser

- Sandboxed Electron WebContentsView with address/search entry, Back, Forward, Reload, loading/error state and expandable viewport.
- Persistent Chromium session for normal browsing and supported authenticated sessions.
- View bounds and visibility follow the workspace and dialogs; focus and event-delivery diagnostics help investigate interaction failures.
- Sandboxed child windows retain the browser session/opener for supported manual popup browsing. Recorded popup actions remain unsupported for replay.
- Context isolation, sender-validated IPC and URL restrictions keep remote websites separate from the Ghost desktop bridge.
- Linux software rendering defaults and process-error logs mitigate graphics failures; renderer crash recovery offers Reload or Close. These changes do not establish that every compositor issue is resolved.

### Recording and storage

- Start, pause, resume and stop recording trusted browser interactions, navigation, inputs, selections, shortcuts, scrolling and action evidence.
- Capture semantic locators, accessible information, context and geometry for diagnostics; replay does not blindly fall back to recorded coordinates.
- Flush pending scroll and input-related state before finalizing. Suppress paused edits that would otherwise appear as delayed change events.
- Local recording metadata, event logs, completion state, editable input overrides and replay results.
- Versioned exports include the full non-sensitive event log and edited inputs; original recordings are preserved.
- Recognized passwords, authentication codes, payment credentials and tokens are masked or blocked. Authentication is handled manually; there is no encrypted credential vault.

### Replay reliability

- Build the replay plan once from the original event stream with input overrides, preserving unsupported-action blockers.
- Rank stable IDs, test IDs, roles/names, labels, placeholders, attributes and context; reject ambiguous, hidden or disabled targets.
- Use Chromium-native input for supported clicks, text replacement and keyboard actions. Verify standard fields, React-controlled fields, textareas, checkboxes, selects and plain contenteditable text.
- Replace blind success delays with bounded, cancellable waits for targets, navigation, values, selections and observable output.
- Record pending, running, verified, failed, skipped, unknown and needs-user-approval states. Stop when a target or result is uncertain.
- Require per-action approval for potentially consequential actions; never automatically retry an uncertain operation.
- Deduplicate controls and submissions using causal evidence, and handle narrowly recognized optional consent steps when already completed.
- Handle navigation failures, redirects, cancellation, renderer crashes and unsupported actions explicitly.

### Validation and documentation

- TypeScript checks, production build, core regression tests and address validation passed during implementation.
- Real Electron tests on Linux/X11 completed 20 successful runs each on standard, dynamic React and changed-UI local dashboards: 60 total.
- After final hardening, a three-dashboard smoke run and 17 grouped failure/edge-case checks passed. The full 60-run suite predates those final hardening changes.
- Added local fixtures, repeatable test scripts and checked-in JSON result reports.
- See [recording and replay reliability](docs/replay-reliability.md) for root causes, implementation functions/files, exact test commands and manual verification steps. The [prototype review](docs/recording-and-replay-review.md) is historical.

### Remaining scope limits

- Local fixture results do not establish general reliability on Slack, Google or other third-party sites. Embedded OAuth restrictions are not bypassed, and credentials/cookies are not transferred to external browsers.
- Frames, replayed popups, dragging, double clicks, modified clicks, downloads and unsupported shortcuts are blocked rather than reported as successful.
- Complex rich text editors, virtualized content and nested/closed shadow roots are not generally supported.
- Verification relies on observed page state, not independent backend confirmation of business transactions.
- Sensitive-field detection is heuristic; local storage is not a secret vault. There is no saved-recording reopening/import UI or complete workflow execution orchestrator.
- Installer packaging and universal Wayland/GPU compatibility are not established.
