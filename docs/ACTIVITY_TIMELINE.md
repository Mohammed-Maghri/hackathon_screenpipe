# Home activity timeline

The Home timeline reads the configured local Screenpipe `/activity-summary` API through `screenpipe:activity` IPC. Authentication remains in Electron main (`SCREENPIPE_LOCAL_API_KEY`, `SCREENPIPE_LOCAL_API_URL`). Restart the full desktop after changing main/preload code; renderer hot reload cannot install new IPC methods.

## Behavior

- Today and Yesterday follow local calendar boundaries. Last 7 Days provides a day picker and an hourly view of that day, not a seven-day total.
- The chart uses Screenpipe's `total_active_minutes` and per-application `minutes`. It does not infer time from frame counts or audio segments. Audio-only days can show zero measured screen activity.
- Click an hour or drag across hours. Edit range & apps opens manual local date/time inputs and the measured application breakdown in a centered dialog. Keyboard users can select hourly buttons or use the fields.
- Discover Workflow retains the Home prompt (or supplies a visible-purpose default request if blank) and passes exact UTC bounds in `selectedRange`. The existing Pipe receives `startTime`/`endTime`; backend formatting and persistence retain the selection. Request hashes include the interval to prevent cross-range reuse.
- Home does not scroll. Saved workflows use square cards and pagination; compact layouts use fewer cards. Full library and teaching behavior remain available.
- Missing bridge, missing credentials, authorization errors, disconnected API, unsupported versions, and malformed/mismatched responses produce explicit states. No demo data is used in the feature.

## Measurement and limits

The adapter queries one bounded daily summary, then up to 25 hourly summaries with at most three requests concurrently. DST days can have 23 or 25 hourly slots. Today stops at the current whole second because Screenpipe normalizes response timestamps to seconds. Completed responses are cached for 60 seconds (maximum 14 days cached); identical in-flight requests are shared. Individual requests time out after 15 seconds and the operation after 60 seconds. Response size is limited to 1 MiB per summary. Failed hourly queries fail the chart rather than silently showing zero.

Requests disable key texts, windows, memories, snippets, and guidance. Some Screenpipe versions still include extra context in the response; the adapter validates and projects only interval, activity duration, app name/duration, and data status into IPC. It neither stores nor logs that extra context. No screenshots, OCR search, or raw history retrieval pipeline is implemented here.

Hourly values are API measurements, not proof of productive work or completed business actions. References in the redesigned Evidence tab remain explicitly unverified when reported by the agent.

## Verification

- `npm run build`
- `npm test`
- `npm --prefix backend run build`
- `npm --prefix backend test` includes `activity-timeline.test.ts` and exact-selection Pipe integration tests.

Browser UI regression (test fixtures are injected only into the isolated test browser):

1. Serve `out/renderer` on loopback port 5188, e.g. `python3 -m http.server 5188 --bind 127.0.0.1 --directory out/renderer`.
2. Start isolated Chrome: `google-chrome --headless=new --remote-debugging-port=9338 --user-data-dir=/tmp/ghost-timeline-check about:blank`.
3. Run `node scripts/check-activity-ui.mjs`. Optional `GHOST_UI_URL` and `GHOST_UI_DEBUG_PORT` override the defaults.

The script checks square cards, no Home overflow or card/timeline overlap at six sizes down to the desktop minimum 760×620, click selection, manual-input dialog access, exact discovery handoff, and the seven-day picker. It is separate from live-data verification.

Live verification during implementation: October 10 returned 24 hourly buckets, one active bucket and one application. Today returned zero measured screen activity; this is shown as an empty screen-activity day rather than fabricated bars. The actual desktop IPC bridge was also tested. This does not certify successful AI discovery for every interval.
