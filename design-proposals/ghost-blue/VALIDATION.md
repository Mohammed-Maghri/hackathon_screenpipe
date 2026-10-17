# Proposal review

This validates the isolated prototype, not the Ghost application or its execution runtime.

## Evidence

| Check | Result |
| --- | --- |
| Standalone TypeScript, including unused-import checking | Pass |
| Standalone production bundle | Pass; Inter bundled locally, no remote font fetch |
| Browser interaction/responsive/contrast checks | **195 passed** |
| Layout matrix | **70 combinations**: 7 views × 2 themes × 5 window sizes |
| Viewports | 1440×960, 1280×800, 1024×768, 760×620, 390×844 |
| Outer horizontal overflow | None in the layout matrix |
| Browser runtime errors | None |
| App/backend/Screenpipe/external requests from preview | None |
| Text/status contrast spot checks | **16 passed**, at least **4.80:1** on the tested surfaces |
| Meaningful control-boundary contrast | **4 passed**, at least **3.14:1** |
| Existing app | Electron/Vite still listening on localhost:5173; backend health reports database up |
| Production file changes | None; all deliverables are under `design-proposals/ghost-blue/` |

Machine-readable viewport and contrast evidence: [validation.json](./validation.json).

The 390 px pass is a stress check, not a claim that Ghost is a mobile product. The desktop minimum remains 760×620. These checks are not a complete accessibility certification or native Electron recording test.

## Interaction coverage

- Whole-card editor navigation; independent Run, Schedule, and Delete actions.
- Delete confirmation and cancellation without losing a sample workflow.
- Native dialog Escape handling and focus restoration.
- Collapsed workflow description and explicit expansion.
- Single-click node selection, double-click settings, Enter for keyboard editing.
- Anchored plus menu, separate node/connection dialogs, Escape dismissal.
- Clearly labeled sample run result; Clear removes results while keeping all nodes.
- Template-to-independent-sample-draft flow and visibility in Drafts.
- Workflow filtering/search and an actionable empty-search result.
- Ctrl+K workspace search and quick-action form.
- Compact sidebar persistence across reloads.
- Light/Dark persistence and System reacting to live OS preference changes.
- Named visible buttons across all reviewed page/theme/window combinations.
- Introduction action above the fold at 760×620 in both themes.

## Visual review

Reviewed full desktop Home, Workflows, Editor/inspector, Settings, Teaching, Introduction, Search, and system/component board. Reviewed compact Home, Editor, and Introduction screenshots. The strongest page action stays identifiable; operational metadata is subordinate; no lime remains in the proposed palette.

| Area | Decision and rationale |
| --- | --- |
| Hierarchy | Composer first on Home; cards first in the library; graph first in the editor |
| Typography | Inter 400/500/600, sans controls, six normal text roles; no pervasive monospace |
| Reference color | Exact #3478F7 for brand/selection; #2D6DE0 for accessible white action labels |
| Dark mode | Purposeful slate surface hierarchy with readable secondary text |
| Scope | Real app behavior described as preservation requirements, never claimed as implemented by the mockup |

## Static detector audit

Ran `ui-craft-detect` on the existing renderer and the proposal without autofixing either.

- Existing renderer baseline: **22 errors / 3 warnings**, across 47 files. These are heuristic findings, not confirmed product defects. Production changes were outside this task.
- Initial prototype: **4 errors / 2 warnings**. Added explicit field naming and an appropriate main-content focus treatment; verified the actual dialog focus behavior in the browser.
- A later scan also traversed Vite's ignored dependency cache and reported **3 errors / 3 warnings** across 12 files. This includes generated React code and the composite-input focus patterns explained below; it is not a clean static-detector result.
- The remaining heuristic findings are reviewed below. The counts span different file sets and should not be read as a comparable design score.

| Finding | Review |
| --- | --- |
| Delete without confirmation | The delete action is inside a native confirmation dialog naming the sample workflow. Browser check verifies the dialog appears and Cancel preserves it. The detector does not follow this component/conditional boundary. |
| Too many font sizes | A single stylesheet includes seven page layouts, responsive steps, brand lettering, and a deliberately oversized “Aa” specimen. The normal application ladder is six roles; the board is a catalog, not one application view. |
| Hover without focus in tokens | Token identifiers such as `--accent-hover` match the heuristic. The token file contains no actual hover selector. Interactive focus styling is defined in `styles.css`. |
| Composite inputs remove their inner outline | The composer and search input use an enclosing `:focus-within` ring instead of a second inner outline. Both remain visibly focused. The detector's local rule does not connect the wrapper to the inner input after formatting. |
| Pure black in generated dependency cache | A React development-runtime debug string in ignored `.vite/deps/` is vendor code, not the proposal's visual palette. It is not shipped as application text styling. |

## Boundaries

Execution, backend autosave/recovery, real schedule validation, graph connection/condition semantics, imports, sharing, native title-bar coordinates, and Electron embedded-browser bounds still require verification during a separately authorized app implementation. The preview does not read or write user workflows, recordings, or app preferences.
