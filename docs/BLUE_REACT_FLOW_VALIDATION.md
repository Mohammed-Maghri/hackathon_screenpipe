# Ghost / Blue implementation validation

2026-10-17. Implements the approved `design-proposals/ghost-blue` direction in the real application. The proposal remains a separate demo; its sample records and review controls are not production data.

## Delivered

- Shared blue/neutral semantic tokens, locally bundled Inter typography, Light/Dark/System preferences and live OS updates.
- Consistent workspace sidebar, actual recents, workspace search, templates and accessible compact navigation. Native macOS controls retain their56px full-width title bar and112px clearance.
- Focused Home composer with existing discovery/source/range behavior, recent cards and activity disclosure.
- Workflow collection cards with prominent node counts, stretched editor links and independent Run/Schedule/Delete controls.
- React Flow custom nodes, typed handles, validated connections, dragging, keyboard selection/settings, edge deletion, pan, zoom, fit and optional minimap. Node details use a side inspector; workflow descriptions start collapsed.
- Simplified Settings and welcome layouts. Teaching prioritizes the native browser, with controls below and captured actions beside it or in a compact-screen dialog.

## Compatibility

No saved-data schema migration. The adapter reads/writes the existing node IDs, x/y positions, configurations, typed contracts and edge identities. Viewport, selection and measurement state are not saved as graph edits. Opening an existing graph causes no write. New templates use vertical positions; existing positions remain intact. Autosave, recovery, schedules, execution and native-browser IPC remain the existing implementations.

Rollback is a presentation/dependency revert. Saved records remain readable by the previous version.

## Verification

| Check | Result |
|---|---|
| `npm run build` / TypeScript | Pass |
| Core capture/replay/credential/persistence logic | Pass |
| Processing operation/file/security tests | Pass |
| Backend suite including PostgreSQL integration |88 passed,0 failed,0 skipped |
| `check-blue-flow.mjs` |Pass: unchanged record on open, stable graph IDs/configs, click versus double-click/Enter, drag persistence, real handle creation, cycle rejection, edge deletion, reload, zoom/minimap, search, independent card actions, Clear results preserves graph |
| Blue layout/theme checks |30 combinations: Home, Workflows, editor, Settings, welcome × light/dark ×1440×960,1024×768,760×620; no outer horizontal overflow, Inter loaded, primary welcome action visible |
| Appearance |Light/Dark/System, live OS changes and reload persistence passed |
| Durable template draft test |Pass: creation failure/retry, graph/node/name/drag edits, edge IDs, serialized writes, fast navigation, Drafts listing, full restarts, failed-save recovery, reusable source template |
| Browser/Settings integration |Pass: real capture, preserved session/recording, modal occlusion, delayed startup, URL/name/description/instruction edits and reload |
| Compact teaching |Pass at1440/1024/760: native browser bounds follow DOM; compact actions dialog hides/restores the same guest |
| Processing UI and Electron execution |Pass: typed mappings, save/reload, actual browser downloads→processing→verified Excel output, invalid-node propagation |
| Runtime logic and schedules |Pass: generation/test/save/reuse, actual output contents, changed-objective blocking, schedule IPC save/list/remove |
| Activity UI |Pass: disclosure, range selection/drag/manual input, seven-day picker, discovery payload, empty/disconnected states, evidence inspector |
| Native macOS chrome |Pass across routes, expanded/compact navigation, three sizes and both themes |
| `git diff --check` |Pass |

`npm run test:blue-flow` builds and runs the new isolated Electron fixture using the `playwright-core` dev dependency. Other UI fixtures remain under `scripts/`; their selectors now follow the side inspector while retaining the original behavioral assertions. All fixtures use temporary profiles and data.

## Existing limitation reproduced on baseline

The broader `GHOST_TEST_RUNS=1 node scripts/check-reliability.mjs` smoke test stalls at **Native select did not change** on this macOS host. The same failure was reproduced from the untouched prior commit `a7c2f32` in a separate temporary checkout and profile, before applying the design/React Flow changes. That suite is therefore not reported as passing. Capture, browser lifecycle, actual downloads/processing, and replay logic have the independent passing coverage above. No guest input or replay behavior was changed to work around the harness.

The build also retains its existing large-chunk and dependency annotation warnings; it succeeds.

## Visual evidence

Reviewed real Electron screenshots with isolated fixture records (not user data):

- `.ui-craft/screenshots/blue-home-light-1440.png`
- `.ui-craft/screenshots/blue-settings-dark-1440.png`
- `.ui-craft/screenshots/blue-editor-dark-760.png`
- `.ui-craft/screenshots/blue-welcome-light-760.png`

Native child-browser composition is checked through its actual bounds/visibility diagnostics; a renderer screenshot alone cannot establish native guest correctness.

## Onboarding refinement

2026-10-17: reorganized Welcome into an introduction/action column and a labeled example workflow, with appearance/help grouped in a footer. Compact windows retain the introduction and main action; no example is inserted into saved records. The titlebar keeps its56px native spacing.

Build/typecheck passed. Focused isolated Electron verification passed12 layouts: light/dark ×1440×960,1280×800,1100×700,1024×768,900×620,760×620. No horizontal or content overflow; the primary action fits without scrolling. Verified intact Create/Skip/walkthrough navigation, dialog Escape and focus return, all example icons, Light/Dark/System persistence and live system appearance. No renderer exceptions. Dev Vite serves the updated component.

Reviewed screenshots:

- `.ui-craft/screenshots/blue-welcome-light-1440.png`
- `.ui-craft/screenshots/blue-welcome-dark-1440.png`
- `.ui-craft/screenshots/blue-welcome-light-760.png` (updated)

## App icons and recording dialog spacing

Replaced the glossy application PNGs with ten local, flat brand SVGs, including a dedicated Outlook mark. Source and license details live beside the assets. Reviewed all marks and aliases in both themes without broken images; the old PNGs totaled13.8MB and the replacement SVGs total10.5KB.

The recording test dialog groups its actions with12px horizontal and vertical gaps, and leaves16px before the mode explanation. Focused browser verification passed8 combinations of light/dark, desktop/compact, and blocked/ready states. Buttons wrap without touching and retain their existing disabled states and handlers. Build/typecheck passed after the spacing change.

PR preparation reran the build, core, processing, runtime logic, and complete Blue/React Flow fixture successfully, including all30 page/theme/size combinations. The standalone proposal check uses the repository's Playwright dependency with optional browser-path configuration instead of a machine-specific import.
