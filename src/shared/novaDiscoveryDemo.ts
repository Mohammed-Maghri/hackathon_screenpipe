/** Presentation fixture, never evidence of a real Screenpipe search. */
export const novaDiscoveryDemo = {
 source: 'demo' as const,
 verifiedObservations: false,
 evidenceIds: [] as string[],
 response: `DEMO SCREENPIPE RESPONSE — prepared context, not recorded observations

WORKFLOW: NOVA weekly sales and inventory review

The requested outcome is a buying list for the next planning period. The routine connects the NOVA store dashboard, locally downloaded spreadsheets, and a report prepared for a human reviewer. Ghost should treat the website work as one browser task and keep the calculations and reporting as separate local steps.

1. UNDERSTAND THE REQUEST
The user wants to review sales and inventory, work out what needs replenishment, estimate the cost, and prepare a report. Monday is the requested cadence, but this demo run is started manually. Do not claim a recurring schedule has been enabled. The current run must use current exported data rather than numbers mentioned in this prepared description.

2. COLLECT THE SOURCE DATA
Use the configured demo website at https://hackathon-screenpipe.vercel.app/nova/restocking. This address comes from the demo configuration, not a Screenpipe observation. The browser task includes signing in, opening the restocking dashboard, and downloading its sales CSV, inventory CSV, and reference Excel workbook. Use the saved browser recording for interaction details. This response does not specify clicks, selectors, coordinates, or credentials.

The sales export provides order identifiers, product identifiers, sale dates, quantities, order status, and reporting-period boundaries. The inventory export provides product names and identifiers, stock on hand, suppliers, unit costs, delivery lead times, incoming quantities and dates, the planning date, safety days, review period, and budget. Both reporting periods must agree. Missing files or inconsistent columns must stop processing rather than produce guessed recommendations.

3. TURN THE FILES INTO READABLE DATA
After the browser completes, pass the verified download references to the next node. Resolve paths on the same computer that executed the browser task. Parse the CSV headers into JSON keys and the rows into records. Convert each sheet of the reference Excel workbook into readable JSON rows when that workbook exists. Save the conversion as browser-exports.json. Preserve references to the source run so the reviewer can trace the output back to its inputs.

4. CALCULATE THE BUYING RECOMMENDATION
Use raw sales and inventory exports as calculation inputs. Count eligible sales inside their reporting window and calculate a daily sales rate for each product. Account for existing stock, supplier lead time, review period, safety days, and eligible incoming deliveries. Determine recommended quantities and estimated purchase cost. Highlight urgent items and budget overruns. Do not copy the reference workbook's recommendation and present it as a new calculation. Do not invent quantities or substitute sample totals if a product or date is missing.

5. PREPARE THE REPORT
Pass the structured calculation to the report node. Produce an Excel buying list, a CSV version, and JSON calculation details. Include product-level explanations, planning assumptions, and source references. These files should remain on the executing computer and appear in the run results. Reviewers should be able to inspect both the incoming JSON and the resulting report files.

6. PREPARE A TEAM UPDATE
Use actual calculated quantities, costs, urgency flags, and budget warnings to prepare a Slack message draft. No Slack destination has been configured in this demo. Save the message locally and clearly mark it as not sent. A real delivery adapter and an authorized destination would be required to publish it.

7. HUMAN REVIEW
Present the buying list and draft for approval. Approval records a review decision; it does not place orders, make payments, or send the Slack message. Preserve the run's outputs and allow the reviewer to inspect each node's input and output.

INFORMATION TO CONFIRM
Confirm the reporting window, planning assumptions, supplier lead times, incoming deliveries, budget, and eventual Slack destination. Login details must remain in Ghost's protected local recording store and must not be included in this text or exported script.

EVIDENCE AND LIMITATIONS
This is a prepared demo response. No Screenpipe history was searched and there are no verified observation IDs. The browser task, conversion, calculations, and generated files must be verified through the actual workflow run. The saved board is a prepared interpretation of this context, not a fresh AI generation on every execution.`,
 stages: ['Browser exports', 'Readable JSON and buying calculation', 'Excel / CSV / JSON report', 'Local Slack draft', 'Human approval'],
}
