# Desktop redesign — review surface

**Ghost / Air · approved and implemented · 2026-10-17.** The user approved the preview and requested the system across all existing application surfaces. Production uses shared tokens, controls, navigation, and light page styles while retaining real actions and data states. Canonical production tokens: [tokens.css](../../src/renderer/src/styles/tokens.css). The [standalone preview](../../design-preview/index.html) is retained as the visual reference.

## Preserved behavior

- Ghost identity, saved workflow identity, and routes: Welcome, `/dashboard`, `/workflows`, `/workflows/:id`, `/workflows/:id/record/:nodeId`.
- Discovery prompt/time range and retry, persisted workflow loading, status filters/pagination, creation/deletion, and scheduling.
- Canvas editing, readiness, save/export, typed contracts, teaching, replay testing, and processing results.
- Keyboard/focus/reduced motion, Electron controls/dragging, and recorder browser bounds handling.

Preview aliases such as Templates, Activity, Connections, and Record a routine are proposed access points to existing concepts. Their layout does not authorize new production integrations or capabilities.

## Approved reference translation and measurements

Borrow the mobile reference's soft light surfaces, breathing room, rounded forms, fine shadows, and pastel shortcuts. Adapt to persistent desktop navigation, a wide composer, readable workflow rows, and a useful editor. The preview uses local Geist, slate neutrals, sky action blue, and sky/peach/lilac creation cards.

Baseline 1440 × 960: 216px sidebar, 64px header, main padding 40px 40px 28px, Home right column 252px with 28px gap, inspector 276px, and library rows 80px. At 1600px+: padding 48px, right column 288px with 40px gap, inspector 300px, and recent rows at least 88px. The system board summarizes the 40px baseline desktop page padding; compact and wide adaptations are defined in component CSS.

Primary desktop text uses 14px navigation/workflow names, 12px captions, and 18px creation titles. Production reduces auxiliary widths on smaller desktops and collapses navigation to a rail below 1024px. The real recorder places captured actions below the browser at 1200px and below, retaining Steps/Console and controls. Below 761px, a visible instructions button opens the existing browser-occluding dialog with the live checklist. The preview's bottom navigation remains a reference composition; production preserves the app's shared rail.

## Views and local interactions

| View | Current preview behavior |
|---|---|
| Home | Prompt composer, three shortcuts (describe, demonstrate, templates), sample recent workflows, illustrative saved time, sample readiness/activity. Submitting a prompt opens a sample workflow explanation; it does not generate or save a workflow. |
| Workflow library | Five fixed sample records; local name/app search and All workflows/Ready/Needs attention/Drafts filters. Rows open the same sample editor. New workflow focuses Home's composer. |
| Editor | Three sample steps, selectable nodes/inspector, zoom/fit, and local dialogs for steps/runs/settings/testing. Test explains the unfinished teaching step; no workflow executes. |
| Recorder | Static browser composition and instructions. Start demonstration reveals three explicitly simulated actions; no browser opens and nothing records. |
| Design system | Palette copying, typography/spacing/radii/elevation, controls, and loading/empty/error specimens. Buttons demonstrate local feedback; specimens do not query data. |

Search and view navigation are local. Account, connection, settings, and activity dialogs are explanations. “Save step changes” retains the description in memory for this preview session; reloading resets it and no app data is written. “All changes saved” belongs to the fixed sample composition, not an app save status. Review controls and sample labels sit outside the proposed app shell.

## Demo honesty and production distinctions

The preview labels itself **Interactive concept · Sample data**, shows **Preview mode** beside Screenpipe, labels illustrative time saved, and states that demonstration actions are simulated. Connections must never imply a working account. Composer confirmation explicitly says it opens sample steps without generation/save; recording explicitly says no external action occurs.

Production discovery currently simulates Screenpipe activity before AI generation. It is not a live Screenpipe connection. Home statistics/activity are illustrative, while saved workflow APIs and persistence are real in Electron. Preserve the real loading/error/data responses during migration; do not use sample values as fallbacks for unavailable data.

Production Run/Schedule processes the latest verified browser downloads; it does not automatically replay browser recordings. Preserve that distinction in execution dialogs. Recorded is not Learned; readiness must come from actual workflow/recording state. Do not carry preview copy implying available account settings or live connection setup into implementation unless those capabilities exist.

## Preserved state coverage

These production states retain their original data and action handlers:

| Surface | States and next action |
|---|---|
| Discovery | Empty/editable, preparing simulation, generating/saving, failed/Retry, completed/Open board; retain prompt and prevent duplicate submissions. |
| Workflow list | Loading, populated, first empty, no filter/search matches, failure/Retry, refresh preserving data, pagination. Preserve production status filters as well as any reviewed readiness grouping. |
| Actions | Creating/saving, invalid input, unsaved edits, running, schedule failure, deletion with accurate consequences; confirm completion only after success. |
| Canvas/node | No selection, selected, Draft, Needs teaching, Recorded/needs testing, Needs configuration, Learned/Ready, processing, failed, missing workflow/back. |
| Recorder/replay | Opening/desktop required, recording, paused/sign-in paused, stopped/saved, replay blockers/approval, running, failed/resumable, completed/results. |
| Connection/data | Preview, disconnected, unavailable backend, partial data, input sync pending/failed; unavailable is never silently zero. |

Keep errors beside the affected task with a useful next action. Pair color with labels/icons and preserve visible keyboard focus. Loading should retain layout without pretending to display live values.

## Recorder constraint and migration map

The production Electron browser is positioned from its measured viewport. Preserve `ResizeObserver`, bounds updates, scroll/resize/visibility listeners, and dialog detection in `RecordStep.tsx`. Hide the browser beneath overlays. Avoid transform-based page transitions and animated dimensions around that viewport. Verify wide mode, resizing, dialogs, replay summaries, and browser error banners.

After visual approval: establish approved tokens in the current CSS/Tailwind stack → unify controls/sidebar/header/composer/rows → migrate Welcome, Home, library, canvas/inspectors, recorder/results → remove conflicting hardcoded overrides → verify data/keyboard/contrast/responsive/reduced-motion/Electron behavior. The standalone preview is not a production implementation or end-to-end proof.

Current stack: React + Electron, HashRouter, Tailwind v4 with substantial plain CSS, Motion, bundled fonts, vector Ghost mark, raster app artwork, raster UI icon sprites. The prototype uses one consistent inline SVG icon set; decide its production adoption during implementation.

The detector's **29 heuristic findings remain unverified**. They are inspection prompts, not confirmed defects or a production quality score.

## Implementation notes

- Welcome, Home, saved workflow library, canvas/editor, node/processing inspectors, recorder, replay results, and shared dialogs use Ghost / Air.
- The real editor keeps its complete modal inspector and all existing tabs and actions. The preview's shortened persistent inspector is illustrative.
- Existing icon imports now resolve to currentColor Lucide SVGs; Ghost retains its original vector silhouette.
- Home session drafts/imports/templates open their local editor directly. They remain session-only; library creation still uses its existing backend API.
- Electron's window background and renderer theme metadata match the light canvas. Native bridge and execution implementation are unchanged.
- The original preview remains isolated; its sample records are never a production data fallback.
