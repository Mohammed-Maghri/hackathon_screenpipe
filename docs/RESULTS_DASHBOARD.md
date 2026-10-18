# Results dashboard

Ghost now has three main navigation entries: Home, Workflows and Results (`#/results`). Results reads real persisted browser run reports on this device. It does not create simulated runs or claim a whole workflow graph has executed.

## What is available

- Workflow filter, saved browser-run counts, verified/attention counts and registered download counts.
- Per-run timestamp, duration, action outcomes and failure category.
- Download list with a main-process, registered-file-only Show file action.
- NOVA inventory comparison by Product ID against the strictly earlier successful run of the same workflow and browser node, including replacement recordings.
- First-run baseline, added/missing products, no-change rows, unreadable-record warnings, and useful empty/error states.
- Existing light/dark appearance, responsive layout and native window controls.

History lives under Electron userData / recordings / recording ID / runs / run ID.json. Session metadata supplies the browser node identity. No new execution pipeline or database is introduced. Existing run history appears on refresh. Unfinished/crashed runs that have not written a terminal run report are not shown as successful. The page does not include separate processing-engine or scheduler histories yet.

Comparison reads the completed `nova-restock-inventory.csv` artifact (up to 2 MB and 10,000 rows), validates unique product IDs and nonnegative stock values, and computes current minus previous stock. Failed runs and different nodes are excluded. Missing products are not treated as zero. A missing, changed-schema or ambiguous export produces an unavailable message, not an invented result. Inventory changes alone are not classified as sales, demand or purchase recommendations.

File actions re-read the saved report, check run/recording identity and enforce realpath containment in that recording's download directory. Credentials, raw input events, DOM text and diagnostic target details are not sent to this page. Imported pre-taught templates alone do not appear as completed runs.

## Verification

- `node scripts/check-results.mjs`: disk-backed history, baseline/change calculations, failed/other-node exclusion, credential/evidence omission, malformed inventory and artifact path confinement.
- `GHOST_RESULTS_SOURCE=<isolated profile with actual saved replays> node scripts/check-results-ui.mjs`: empty state, real captured NOVA run reports, comparison, first baseline, sidebar navigation and responsive UI in Electron. The test copies reports/downloads into a disposable profile and updates only their local artifact paths; it does not alter the source profile.
- Root typecheck/build and core regression suite.

Buying recommendations, sales-rate comparisons, editable approval and Slack delivery are not implemented by this dashboard. NOVA's exported reference workbook remains NOVA-calculated; the dashboard does not claim it was calculated by Ghost.
