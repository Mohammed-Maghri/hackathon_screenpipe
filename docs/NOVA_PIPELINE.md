# Workflow Results and NOVA execution

Results is scoped by workflow ID (`#/results?workflow=<id>`). Every saved workflow can be selected, including workflows with no runs. The board’s **View results** button opens its own results. Browser reports, downloads and comparisons are restricted to that workflow. No example statistics are inserted.

NOVA-specific reports appear only for workflows registered with the supported NOVA runtime. Other workflows show their actual browser run history and files. This does not add arbitrary integration execution or finance calculations for other workflows.

## Running NOVA

1. Generate a new NOVA shopping-list workflow from Home. The six-node definition, saved browser task and local script package are prepared together. Opening the original five-node prepared NOVA template upgrades its remaining nodes. Its full original graph is backed up in localStorage under `ghost.nova-upgrade-backup.<workflowId>`; the workflow ID, browser node ID, recording and login remain intact. Custom graphs are not automatically upgraded.
2. Open its board and choose **Run workflow → Start complete workflow**, or choose **View results** to use the report controls.
3. Choose **Run workflow**. A separate browser window signs in to the hosted demo and replays the saved task.
4. Ghost verifies the exports, calculates restocking from that run’s sales/inventory CSVs, and saves Excel, CSV, JSON and a Slack message draft.
5. Review the purchase quantities, cost and urgency. Expand product calculations or execution details when needed. Approve the report explicitly.

The first node validates the saved request; it does not search Screenpipe. The Slack node creates a local draft; it does not send a message. Approval records your decision without placing orders or sending messages.

## Schedules and files

Expand **Scheduling and run options** to create three one-time runs due in 1, 2 and 3 minutes. They execute sequentially, take fresh browser exports, and independently await review. Keep Ghost open. Pending schedules can be cancelled. Interrupted runs are not automatically retried. These are three schedules for the same graph, not three fake executable graph nodes.

Files and run journals live under Electron’s user-data directory, `nova-pipeline/`. Generated modules live under `workflow-scripts/<workflow>/<revision>/`. Browser recordings and encrypted credentials remain in the existing recording store. Generated script bytes are hash-checked before execution and call trusted local adapters. Downstream nodes do not use stale exports if the browser fails.

## Current limits

The full graph runner supports the six defined NOVA operations. Existing browser results work for other workflows; custom output-specific charts and additional integration adapters must be implemented for their schemas. Stock comparison is shown only when a compatible inventory export exists. Local test schedules are not a cloud scheduler, and do not wake a closed application.

## Logic regression checks

`node scripts/check-nova-logic.mjs` checks paid-sales demand, excluded cancelled orders, incoming deliveries, budget/urgency, changed stock, schema failures, real Excel file contents, draft totals, approval, downstream blocking, three schedules, persistence and migration identity preservation. Its browser adapter is explicitly stubbed; `node scripts/check-nova-pipeline-electron.mjs` separately runs the actual hosted browser through the board’s Run control.

## Buying proposals and browser outputs

The calculation node copies the two CSV inputs into the pipeline run folder and records SHA-256 hashes, names and byte counts. It validates their schemas and reporting periods before calculating. The original Excel report includes a Sources sheet. Source previews reject changed snapshots and support files up to 100 KB; larger files can be revealed in the file manager.

`src/shared/buyingPlan.ts` implements budget allocation and recommendation comparison. Budget allocation prioritizes urgent products, then lowest stock coverage, and uses integer cents. It is deterministic greedy allocation, not an optimal purchasing solver. Shipping and tax are excluded. Unknown product IDs, negative/fractional quantities and invalid budgets are rejected. Manual quantities can exceed the budget; the UI and message flag that condition.

In Results, expand **Adjust the buying list**. Set a budget for automatic allocation or edit individual quantities. **Save proposal and Excel** creates a separate proposal revision, Excel workbook, JSON and message draft through the local report runtime. Proposal files reference the source run and hashes. Saved proposals retain their own approval timestamps; a new proposal never inherits approval from another proposal or the original report.

**What changed since the previous run?** compares original calculated quantities within the same workflow. Added and missing products stay distinct from zero. Neither proposals nor comparisons rerun the browser or overwrite its downloads. No external messages or orders are sent.
