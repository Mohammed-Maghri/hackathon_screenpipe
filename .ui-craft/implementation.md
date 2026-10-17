# Ghost UI implementation — 2026-10-17

Current visual direction is Ghost / Screenpipe. Earlier sections record the approved Air implementation and later user corrections; the latest sections supersede earlier visual and layout choices.

The user approved the standalone design direction and authorized applying it across the app while preserving existing functionality.

Shared production foundations are `src/renderer/src/styles/tokens.css`, `globals.css`, and Tailwind utilities alongside the React components. Welcome, Home, the workflow library, canvas/editor, inspectors, recording, replay summaries, and dialogs use the approved light system. The original preview remains isolated. Existing backend/native bridges and execution logic were preserved; the main-process change only aligns the window background.

Home-created/imported/template drafts now open their session editor directly instead of disappearing into the backend-only library. Recorder Steps/Console, captured actions, and controls remain reachable in compact layouts. Mobile instructions use the existing browser-occluding dialog and retain the live checklist.

## Verification

Passed on the implementation:

- Typecheck, production build, whitespace checks, and native startup/render capture.
- Core recording/replay data, encryption/login, input overrides, checkpoints, and saved-step tests.
- Data-processing and runtime-logic suites, including actual generated CSV/JSON/XLSX contents.
- Native browser settings and saved field reload, typed-data inspector save/reload, processing conversions, verified downloads/replay, modal occlusion, runtime generation/reuse, workflow run and scheduling checks.
- End-to-end discovery: original prompt/time range, five-second simulation, duplicate guard, generation, saved board, teaching URL autosave, recording-page navigation, rename/save/reload, Home/library updates, delete confirmation/cancellation, and backend recovery. Existing fixture/schema and event/selector mismatches were corrected without weakening assertions.
- `scripts/check-air-ui.cjs`: welcome dialogs, local draft retention, templates, inspector, light theme, responsive routes, and recorder tabs. Run it with Electron after building.
- Visual and bridge-fixture checks across 1440/1280/1024px, with recorder and library checks down to 390px. These do not replace a complete accessibility audit.

## Existing broader replay-harness limitations

- `check-reliability.mjs` stalled at native macOS select automation after a trusted ArrowDown; the guest page was waiting in its native selection interaction. The full repeated-run benchmark did not complete. Core select normalization and other actual native download/replay checks passed.
- `check-resilience.mjs` passed its first eight scenarios but failed the final unsupported expectation. Reproduced on the original dark renderer at HEAD `23e182c`: the harness reused the same stopped normal recording for the unsupported scenario, retaining the same recording ID and event count. This is a pre-existing fixture-isolation issue; replay logic was not changed to satisfy it.

The migration is implemented and the focused functionality checks pass. Do not describe the two broader benchmarks above as passing.

## Typography, Tailwind, and native frame correction

The follow-up replaces Geist with the native system sans stack (SF Pro on macOS) and native monospace for diagnostic content. Headings use moderate tracking and appropriate medium/semibold weights. The renderer no longer loads font assets.

All production screens and shared components now use Tailwind CSS v4 utilities, including states and responsive rules. The `@theme inline` bridge maps semantic colors, typography, radii, and shadows; repeated controls use shared `@utility` recipes. Deleted dashboard, workflows, and shell stylesheets. Remaining custom rules cover only base/native integration, the canvas dot grid, and loading keyframes. Runtime canvas positions and zoom remain calculated styles. Primitive radius/elevation names are prefixed `air-` to preserve Tailwind's built-in scales.

The renderer fills its native window. Removed the root gutter and CSS window border/radius/shadow. Native window corners, traffic lights, and drag behavior remain available. Welcome's illustration also uses an unbordered surface.

Follow-up verification passed: typecheck and production build; native startup; the expanded Air UI smoke (including native font stack and full-bleed borderless bounds across routes at 1440/1280/1024); core data/encryption/replay planning; processing and runtime unit suites; backend-backed processing inspector save/reload and browser-recorder controls; native browser settings and recording retention. Headless bridge-fixture checks cover responsive library/recorder interactions down to 390px. Recorder lifecycle/bounds/actions and library data logic match the original source; editor AST comparison confirms business/lifecycle/event expressions are preserved.

Token lint is clean. The heuristic anti-slop scan was reviewed rather than treated as an accessibility certification: modal findings refer to components wrapped in the native DashboardDialog, deletion findings refer to existing confirmation dialogs or removal of a temporary download anchor, inputs have enclosing labels or aria-labels, tables have overflow containers, and focus is supplied by global focus-visible rules or a focus-within wrapper ring.

## Dark mode

Added Light/Dark/System appearance settings on Welcome and in shared Settings. Choice persists in `ghost.appearance`; System follows live OS changes. A CSP-compatible external bootstrap applies the initial theme before the main renderer bundle. Invalid or unavailable storage falls back to System. Storage events synchronize open windows.

Dark mode uses semantic token overrides, brighter readable accent text, a separate filled-action color, softer pastel artwork, subdued canvas dots, and appropriate native form color-scheme. The host's validated `appearance:set` IPC updates only the window backing color. Embedded websites retain their own appearance behavior, and recorder bounds, sessions, and dialog occlusion are preserved.

Validated production build/typecheck, focused Electron UI flows, Light/Dark persistence, explicit overrides versus OS changes, live System updates, Settings across routes, core data tests, and native startup/appearance IPC. Headless visual/bridge fixtures cover Welcome, Home 1440/1280/1024, library, editor/inspectors, recorder/compact layouts and dialogs. Measured dark primary text14.26:1, muted7.97:1, primary button5.40:1, hover button4.63:1 and semantic status text at least7.32:1 against their assigned backgrounds. These checks cover the changed theme, not a complete accessibility audit.


## Screenpipe reference reskin

The user supplied 39 Screenpipe desktop captures and requested alignment with its theme/colors/font. Applied a visual reskin of the existing page structure: neutral surfaces, white-on-dark/black-on-light primary actions, thin borders, 6px controls / 8px cards / 10px dialogs, compact sans headings, Inter content and JetBrains Mono controls/metadata. Both fonts are bundled from local font packages. The navigation marker, warm opaque sidebar and neutral shortcut cards follow the captures. Removed Air pastel illustration treatment and decorative panel shadows. Ghost’s name/logo, copy, routes, Light/Dark/System, full-bleed frame, native guest lifecycle and workflow actions remain.

| Review area | Result |
|---|---|
| Reference fidelity | Screenpipe light/dark palette and font roles verified against upstream theme/layout/Tailwind source and user captures. |
| Existing workflows | Page/data/event expressions preserved; editor AST comparison and recorder hook comparison passed. |
| Responsive UI | Home 1440/1280/1024, Welcome down to 760×620, editor/inspectors 1440/1280, library/recorder down to 390px. No horizontal overflow or clipped toolbars in tested states. |
| Native integration | Startup, validated appearance IPC, host backing colors, full-bleed bounds, guest settings/recording persistence and typed inspector save/reload passed. |
| Contrast | Measured secondary text minimum 4.98:1 in light and 7.30:1 in dark on assigned surfaces; primary actions 19.80:1 light /18.16:1 dark. Not a complete accessibility certification. |
| Automated checks | Production build/typecheck, UI smoke, core, processing, runtime-logic and whitespace checks passed. |
| Static design scans | Anti-slop 22→21 findings; token lint 0 across 36 files. Remaining scanner hits are established cross-component false positives: native dialog wrapper, global focus/composer focus, existing labels/aria, confirmation dispatch or temporary download-link removal, table overflow wrapper, and token names. Reviewed without claiming a clean anti-slop scan. |

One extra native browser-settings attempt missed its fixture click: its recording contained only navigation/page-ready, so no meaningful saved recording was created. A diagnostic rerun captured 5 events including click and passed; an unchanged rerun also passed. No product recording code or harness assertions were changed to hide this transient automation failure. That script’s known macOS Electron shutdown hang required terminating only its own already-finished child process.

Current screenshots use `.ui-craft/screenshots/screenpipe-*`. Native browser pixels are absent from web-fixture captures; actual guest behavior is covered by the native tests.

**Craft Read:** desktop workflow app for Screenpipe hackathon users, product language, monochrome light/dark themes, variance 4, signature bet: a slim active-navigation marker.


## Sidebar structure correction

User rejected the retained Ghost sidebar layout and requested the actual Screenpipe structure. Replaced its large logo, workspace selector card, Workspace subsection, connection card and avatar footer with a compact utility toolbar, section header, single navigation list, Recents and bottom workspace/Settings/help controls. The expanded sidebar is 240px, navigation rows 32px and recent rows 28px. The reference’s darker selected fill, fine border, muted labels and left indicator now have dedicated sidebar tokens. The native traffic-light area remains available on macOS.

Collapse state persists locally, Recents uses the existing saved-workflow bridge and local draft store, and all existing destinations/panels remain connected. Footer Settings still exposes Light/Dark/System. Native UI and backend-backed inspector/recorder checks passed; actual guest clicks, recording persistence and edited browser settings also passed. The recorder viewport still uses its existing resize observer and bounds reporting; no parent transform or new outer window frame was added.

Final reference comparison passed: selected row x4–231 (227px wide), 32px navigation height, first recent row y339 with 28px height, Automations center y493, and reference sidebar colors. Menus, recent workflow navigation, collapse persistence, Settings and keyboard dialog behavior pass; no overflow at 1440/1280/1024/760. Current screenshots: `screenpipe-sidebar-dark.png`, `screenpipe-sidebar-light.png`, and `screenpipe-sidebar-collapsed.png`.


## Focused Home, full-page Settings and lime

The user approved a structural redesign of Home and Settings plus phosphor lime. Home now has a centered saved-workflow list, compact Inter starter actions and a lower composer outside the list scroller. Sample statistics/activity moved into Activity, retaining all synthetic/sample disclosures and the connection action. Search, refresh, pagination, create/import/templates, original prompt/range submission, duplicate prevention, retry identity and newly generated workflow navigation remain connected to the same handlers.

Full-page Settings provides Back to app, section navigation, search, General, Appearance and Workspace info. It exposes existing app capabilities only. React Router retains the originating page behind an inert overlay, preserving Home prompts/generation, editor state and recordings. Settings acquires the native modal owner before becoming visible. The main-process guard keeps an existing or pending teaching session alive on that same app’s Settings route, detaches its guest while covered and restores it on return; other navigation still disposes it. The recorder defers initial native opening if its backend load completes while covered, and handles both hash events and Router pushState on return. Dialogs watch ancestor inertness so asynchronous replay results wait behind Settings and restore afterward, retaining native occlusion ownership.

Shared action tokens use #C7FF3E with #0A0A0A labels; hover is #B7EB36. Genuine generation/processing/replay progress receives lime markers; idle selections, Ready statuses and approval-paused states stay neutral. Light execution text uses #4F6A12 and a #EEF6D6 tint. Measured button contrast is16.78:1 (hover14.09:1); execution text is at least5.52:1 light and12.52:1 dark on its tinted surface.

Focused checks passed for Home at1440/1280/1024/760, list loading/error recovery, search/pagination, import validation, all draft entry points, generation duplicate prevention/retry/completion, Activity disclosures, and Settings round trips while generating. Settings checks covered search/Cmd+K/empty recovery, Light/Dark/System, origin DOM identity and state retention, sections/direct routes, sidebar collapse and widths down to760. Execution-state fixtures covered actual API RUNNING→VERIFIED, local processing, Run-driven generation, replay running→approval, neutral reset and both themes. Browser-fixture captures exclude native guest pixels; the native fixture verifies guest behavior separately.

Production build/typecheck, core, processing, runtime-logic, UI smoke, backend-backed inspector and native browser settings checks pass. The native recording test asserts guest occlusion, the same active recording/session through appearance changes, reattachment and new event capture on return, plus deferred startup when the backend finishes behind Settings. Focused replay fixtures prove results stay behind Settings, restore and dismiss with normal focus behavior. The full native discovery integration also passes generation, duplicate guard, original prompt contract, teaching URL save/open, editor save/reload, Home/library updates, delete cancel/confirm and backend recovery. Its empty-state assertion was updated to the redesigned “Start with a routine” heading. Its established macOS shutdown hang required terminating only its own child after PASS; the dedicated browser-settings harness now bounds its own shutdown. Native startup and appearance IPC also pass. The runtime-logic harness was rerun sequentially after an initial build/test overlap removed its temporary output; the rerun passed. Token lint reports0 across37 files. Static design scan reports22 findings, including the new noninteractive Settings heading’s programmatic-focus outline; remaining hits use the established global focus, wrapper label/dialog/overflow and confirmation patterns described above. This is not a complete accessibility audit.

Current previews include `screenpipe-home-dark.png`, `screenpipe-home-light.png`, `screenpipe-settings-appearance-dark.png`, `screenpipe-settings-appearance-light.png` and `screenpipe-editor-running-dark.png` in `.ui-craft/screenshots/`.


## Workflow cards

The user requested cards instead of rows. Home saved workflows now form a two-column grid (single column below700px), with a whole-card open action, neutral status, clamped title/description, apps and node/connection counts. The existing lower composer and generation state remain. The Workflows library replaces its horizontally scrolling table with one/two/three-column cards at850/1400px; separate Run, Schedule, Open and Delete controls, last-edited metadata and schedule summaries stay available. Both use the existing Inter/mono typography, neutral surfaces,8px radius and lime primary page action. Library effects, state, handlers and create/run/schedule/delete dialogs are unchanged.

Production build/typecheck, native UI smoke and full native discovery integration pass. The existing discovery fixture targets the new card-grid hooks and runs minimized to stay out of the active desktop. Two initial foreground attempts unexpectedly left Home before the generation assertion; the minimized run passed the original generation, save/reload, teach, delete and recovery assertions. The known macOS fixture shutdown hang still requires terminating only its own child after PASS. Home bridge QA passes at1440/1280/1024/760 with composer visibility, search/pagination, loading recovery, duplicate prevention/retry, generation through Settings and draft/import/template navigation. Library bridge QA passes at1440/1280/1024/760/390 in both themes with long content, all controls, run/schedule/create/delete error/retry paths, schedule persistence, disabled-running state and empty/loading recovery. Scoped token lint is clean for both changed pages.

Current Home previews are `screenpipe-home-dark.png`/`screenpipe-home-light.png`; library previews are `screenpipe-workflow-cards-{dark,light}-{width}.png` in `.ui-craft/screenshots/`.


## Card interaction and compact editor description

The user requested full-card opening, independent Run/Schedule/Delete actions, more prominent nodes and collapsed editor descriptions. Library titles now use a native stretched Link over each card, with a visible full-card focus outline. The title clamp is inside a separate span so it cannot clip the stretched target. Only the individual action controls sit above the link; whitespace between them still opens the editor. This avoids nested interactive controls and preserves native link/keyboard behavior. Home already used a whole-card button and retains it. Actual node counts moved into a bold, strongly bordered neutral badge at the top of Home and library cards; lime remains reserved for primary actions and genuine running state.

Workflow descriptions use native details/summary, closed initially, with Show/Hide description. The complete text and whitespace remain available in a focusable scroll region bounded to min(8rem,18dvh). Header compact rules include the760px window minimum, retaining header actions and the log in short windows. Stored graph positions and all editor business logic/event handlers remain unchanged. The reference-shaped long-title fixture has643px of canvas at1440×960 when collapsed versus507px expanded; at760×620 it retains305px collapsed versus185px expanded.

Validation passed: production build/typecheck and native UI smoke; Home regression including generation, drafts and state through Settings; existing full library behavioral suite; actual pointer hits on card padding, description, apps, badge and footer gaps in both themes at1440/1280/1024/760/390; keyboard navigation and full-card focus; independent Run/Schedule/Delete dialogs and cancellation focus; disabled Run does not navigate. Editor disclosure mouse/Space/Enter, full text/scroll, responsive bounds, rename/save/share/zoom/fit and unchanged node positions pass in both themes at1440/1280/1024/760. Scoped token lint for Home/library is clean. Current previews include `screenpipe-workflow-cards-dark-1440.png` and `screenpipe-editor-description-dark-1440-collapsed.png`.


## Native controls with the collapsed rail

The screenshot showed macOS traffic lights overlapping the sidebar toggle and the adjacent Home context icon. Their native25px/22px position spans beyond the56px rail. WorkflowSidebar now reserves44px above compact Mac controls and applies scoped sibling utilities to clear Home/editor/recorder first-row content. Expanded Mac layout, non-Mac spacing, native window buttons and recording bounds/lifecycle remain unchanged. Both explicit and responsive collapse use the same clearance.

Build/typecheck and whitespace checks pass. Headless fixtures verify Home/library/editor/recorder, manual/automatic collapse,1440/1024/760, macOS/Windows/Linux, no horizontal overflow, collapse persistence and Settings return with zero page errors. A real Electron fixture confirms native window button position {x:25,y:22} and non-overlapping toggle/Home/editor geometry at all three widths. Preview captures exclude native button pixels; native position was verified through Electron itself. Current previews: `screenpipe-mac-rail-home-dark.png` and `screenpipe-mac-rail-editor-dark.png`.

## Shared macOS workspace title bar

The user rejected the spacer-only rail correction: the native traffic lights still crossed the sidebar boundary and the controls looked disconnected. WorkspaceFrame now provides a full-width56px Mac title bar above both workspace columns. Native controls retain their actual25px/22px position; sidebar-owned collapse/menu actions render into a slot after112px of clearance. Both240px expanded and56px compact sidebars begin beneath this bar. The Home context becomes a plain label with no duplicate workflow icon or orphan divider. Windows/Linux keep their existing titlebar and sidebar composition.

The positioned route container owns workspace page bounds, including saved-workflow loading/error states. Sidebar toggles do not remount the editor/recorder. Settings continues to preserve and occlude its originating route. No transforms or guest lifecycle changes were introduced.

Validation: production build/typecheck and whitespace checks pass. A native UI smoke covers existing drafts, editing, appearance and Settings state retention. Headless geometry/interaction checks pass on Home/library/editor/recorder in both themes at1440/1024/760 for Mac/Windows/Linux, with explicit/automatic collapse, menu clicks, prompt retention, collapse persistence and Settings return. The durable native macOS fixture `scripts/check-workspace-chrome.cjs` verifies the real traffic-light coordinates and uninterrupted full-width chrome on Home/library/editor/loading routes. The browser Settings integration now also verifies actual guest bounds against its DOM viewport through collapse/expand, with the same live recording session retained; recording/capture, Settings occlusion/return, delayed startup and saved edits/reload all pass.

Reviewed previews: `screenpipe-shared-titlebar-{dark,light}-{collapsed,expanded}.png`. Renderer captures exclude native traffic-light pixels; those positions are verified through Electron’s native API.

## Pull request integration and final validation

The PR includes the complete visual migration, historical design preview and screenshot evidence. It is rebased onto the latest default branch, including its local Screenpipe discovery pipe and AI formatter integration. Conflict resolution preserves discovery progress, generated-board navigation and source-reference inspection alongside the redesigned surfaces. Current Home, onboarding, workspace settings and connection guidance reflect the live Screenpipe path; earlier screenshots and synthetic-discovery notes describe prior development states.

Validation after rebasing: desktop build/typecheck; backend build and79 tests with no skips; core recording/security/persistence suite; processing and runtime-logic suites; native UI smoke; real macOS titlebar geometry; native teaching browser bounds and recording persistence through sidebar/Settings changes; full Screenpipe pipe discovery using local HTTP/final-file, provider and database fixtures, including generation, save/reload, teaching, deletion and recovery. The discovery fixture now bounds its own Electron shutdown to prevent macOS test cleanup from hanging. No user app process is terminated by that cleanup.
