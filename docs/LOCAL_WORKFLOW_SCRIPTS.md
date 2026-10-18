# Local workflow script packages

Updated: October 17, 2026.

## What is implemented

Open a saved workflow board and choose **Local scripts → Generate scripts**. Ghost generates files from the current board configuration, including edited node settings. It does not call AI or Screenpipe to generate these files.

The package contains one JavaScript module per node, a manifest, and a README. You can preview each file inside Ghost and choose **Open folder**. The most recent package is available again after reloading the app.

```text
<Electron userData>/workflow-scripts/
  <workflow UUID>/
    <revision UUID>/
      node-001.mjs
      node-002.mjs
      node-003.mjs
      manifest.json
      README.md
```

On this Linux setup, the normal profile's base is typically `~/.config/ghost-desktop`. Test profiles have their own separate directories.

Every generation creates a new revision. Old revisions are retained. Files are written into a temporary package directory and published by rename after all writes succeed. The manifest records workflow/node identities, dependency order, inputs, outputs, a fingerprint, and each node's execution requirements.

## What the scripts do

Each `.mjs` file exports a descriptor and an asynchronous `run(runtime, inputs)` function.

| Node | Generated behavior |
| --- | --- |
| Configured manual processing | Pass the validated operation and configuration to `runtime.processing.execute(descriptor, inputs)` |
| Browser | Pass the workflow/node identity and starting URL to `runtime.browser.replay(descriptor, inputs)` |
| Generated processing plan | Block export execution; retain the existing approval/input-fingerprint execution path |
| Slack/integration | Throw a clear error until a delivery adapter is implemented |
| Human approval or other unimplemented node | Throw a clear configuration/adapter error |

Processing includes the existing filter, transform, comparison, aggregation, and report operation definitions. Graph bindings are validated before a processing module is marked as requiring only its runtime. Missing bindings or invalid rules are reported in the package.

## Important execution boundary

These are **runtime-bound modules, not a standalone CLI runner**. Running `node node-001.mjs` loads its exports; it does not execute a workflow.

The existing Ghost Run controls still use the trusted internal engine. They do not import or execute edited files from this folder. Browser modules do not contain a copied action log or login password. Their adapter must resolve the taught recording, authorize the run, execute it, and verify the outcome.

The processing adapter must validate input types and use the trusted processing implementation. A future coordinator must supply current-run outputs, enforce dependencies, stop on failure, handle approval, and persist results. This change does not implement that coordinator or a Screenpipe-to-Slack delivery adapter.

This distinction prevents a generated file from appearing to implement a capability that is still absent.

## Editing and regeneration

The package reflects the board snapshot at generation time. If the board changes while the dialog is open, Ghost asks you to generate another revision. A package restored after reload is labeled as a previous revision; regenerate to capture the current board.

Direct edits to exported scripts do not update workflow nodes and are not executed by Ghost automatically. The export does not change existing recording or secret storage.

## Credentials and local access

- Raw recordings, input values, encrypted credential bundles, connection credentials, prompts, and free-form browser instructions are not copied into scripts.
- Browser URLs reject embedded credentials and authentication-like parameters/fragments.
- Processing configuration is restricted to its schema, with obvious credential fields rejected.
- Ordinary operation constants are exported. Review them before sharing a package; arbitrary text cannot be guaranteed free of private business data.
- Main-process IPC verifies the requesting renderer. File preview/reveal is restricted to validated workflow/revision directories.
- Directory/file permissions are restricted on platforms that support POSIX modes.
- Cycles, duplicate node IDs, and references to missing nodes are rejected.

## Tests completed

- TypeScript and production build passed.
- `node scripts/check-workflow-scripts.mjs` passed: generated modules, real filtering through the existing handler, blocked delivery, omitted test credentials, preserved revisions, cycle rejection, and path validation.
- `node scripts/check-workflow-scripts-ui.mjs` passed: generation from the actual editor through IPC, script preview, local files, latest-package restoration after reload, and invalid path rejection.

The filter test supplied its runtime adapter explicitly. No full exported-workflow runner, browser execution through an exported module, or Slack send was claimed as tested.

## Main code

- `src/main/workflowScripts.ts`: validate the graph and generate/read versioned packages.
- `src/shared/workflowScripts.ts`: package and IPC types.
- `src/main/index.ts` and `src/preload/index.ts`: authorized filesystem bridge.
- `src/renderer/src/components/WorkflowScripts.tsx`: generation, preview, and folder UI.
- `src/renderer/src/pages/WorkflowEditor.tsx`: exports the current board snapshot.

No commit or push was performed.
