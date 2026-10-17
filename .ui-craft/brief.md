## 1. Product purpose

Ghost turns repeatable computer routines into workflows that people can inspect, teach through a browser recording, test, and run.

## 2. Primary user

Proposed audience: a person doing repeated operations or reporting work on a desktop or laptop, moving between describing a routine, reviewing its steps, and checking the result. Specific job roles remain to be validated.

## 3. Three to five principles

**Current direction · 2026-10-17 — Ghost / Blue.** The user approved the standalone proposal in `design-proposals/ghost-blue/` and authorized whole-app implementation plus React Flow. This supersedes the Screenpipe/lime reskin and earlier Air direction.

1. **Start with the routine.** One focused Home composer, compact suggestions and recent workflows.
2. **Keep the canvas clear.** Compact editor header, collapsed description and a node inspector revealed on demand. Use React Flow for graph interaction.
3. **Reveal complexity when needed.** Keep advanced actions in menus and source details in disclosures; preserve every existing capability.
4. **Use blue with restraint.** Reference blue #3478F7, accessible filled actions #2D6DE0, quiet neutral surfaces and a clear blue navigation state.
5. **Make state truthful.** Distinguish Draft, Needs teaching, Recorded, Learned and Ready. Preserve the difference between validation, replay and processing execution; show actual backend records and real activity.

## 4. Success metric for the surface

Proposed acceptance target: a first-time user can identify how to describe a routine and open an existing workflow within 30 seconds. On a workflow, the user can identify the next required teaching or configuration step before choosing to run it; this is a target for later usability validation, not a measured result.

## 5. Out of scope

- Adding capabilities or changing workflow execution semantics as part of the visual migration.
- Changing recording, replay, processing, persistence, or scheduling behavior.
- Adding production integrations, new metrics, account systems, or navigation destinations; preview navigation labels are proposals for existing flows.
- Replacing the Ghost name or vector logo.
- Treating the preview's sample records as saved user data.

## 6. Learned constraints

**Latest approval takes precedence over the historical decisions below.**

- **2026-10-17 — Onboarding organization:** give Welcome a balanced split composition: the Ghost introduction and one primary action on the left, a clearly labeled example workflow on the right, and appearance/help grouped in a footer. Use a restrained blue heading for a stronger focal point. At compact widths, prioritize the introduction; keep the action visible without scrolling at760×620. Preserve Skip intro, the walkthrough and all appearance behavior. *Why:* the previous narrow floating guide felt unorganized and bland.

- **2026-10-17 — App icon correction:** use crisp, flat, recognizable brand SVGs for application marks. Replace the old glossy 3D raster badges across the whole set, with consistent sizing in light/dark themes. Keep the existing Lucide control icons; they already provide a consistent vector system.

- **2026-10-17 — Ghost / Blue approved:** rebuild layouts around the supplied Noera references and approved standalone preview. Use Inter throughout UI, a single blue accent, 8px controls, 12px cards and 16px dialogs. Retain Light/Dark/System, full-window native chrome and all existing functionality. The old lime, mono controls and Screenpipe sidebar composition are superseded.
- **2026-10-17 — React Flow requested:** replace the custom canvas with `@xyflow/react`. Preserve existing graph IDs, positions, contracts, processing configs, edges and backend schema. One click selects, double-click/Enter opens settings; drag handles to connect with existing validation.
- **2026-10-17 — Approved sidebar:** 248px expanded, 224px below1200px, 72px compact; brand, search, Home/Workflows, actual recents, templates and footer utilities. Native macOS chrome remains56px with112px traffic-light reserve.

- **2026-10-17 — User request:** establish a design system and show the proposed appearance before implementing the frontend redesign.
- **2026-10-17 — User reference:** borrow the mobile example's soft light surfaces, generous breathing room, rounded forms, subtle depth, and pastel creation cards; adapt its composition and control sizes for desktop.
- **2026-10-17 — Scope:** the proposed direction is **Ghost / Air**, a light, soft modern desktop system. The original dark/yellow presentation is superseded by the approved blue light theme.
- **2026-10-17 — Desktop baseline:** review at 1440 × 960. Preserve usable hierarchy at 1280 × 800 and 1024 × 768 before expanding to wider screens.
- **2026-10-17 — Technical constraint:** the recorder embeds an Electron browser. Preserve viewport bounds tracking, resize observation, and hiding the browser underneath open dialogs.

- **2026-10-17 — Approved:** user accepted Ghost / Air and authorized the whole-app implementation with all existing functionality preserved.

- **2026-10-17 — User correction:** replace the disliked Geist font with native system sans typography (SF Pro on macOS), with moderate heading tracking.
- **2026-10-17 — User correction:** use Tailwind CSS utilities for production presentation. Keep raw CSS limited to design token values, platform integration, canvas paint, and custom loading keyframes.
- **2026-10-17 — User screenshot:** content fills the native desktop window. Do not add an inset rounded window frame, outer CSS border, or extra window shadow.

- **2026-10-17 — User request:** add dark mode across the app. Light, Dark, and System preferences persist locally; System responds live to OS changes. Retain the native sans typography, Tailwind tokens, and borderless window. The teaching browser’s websites keep their own appearance.

- **2026-10-17 — User request and references:** align Ghost with Screenpipe’s theme, colors and typography. Use the supplied screenshots as the visual authority. Replace the earlier Air blue/pastels, large radii, decorative illustrations and soft elevation with neutral surfaces, compact cards and monochrome controls.
- **2026-10-17 — Verified source:** Screenpipe’s root layout uses Inter for body content; its Tailwind mono stack starts with JetBrains Mono. Bundle Inter Variable and JetBrains Mono Variable locally. This explicit alignment request supersedes the earlier native-sans choice while retaining the rejection of Geist.
- **2026-10-17 — Scope:** reskin the current page structure; preserve Ghost’s name/logo, copy, routes, workflow states, native browser sessions and backend behavior. Retain Light / Dark / System and the borderless native frame.

- **2026-10-17 — User correction:** the sidebar must match Screenpipe’s structure and proportions, not merely its palette. Replace the prior Ghost logo/workspace-card/avatar composition with the main-app reference’s 240px rail, utility toolbar, section header, single compact navigation list, Recents and bottom Settings/help rows. *Why:* retaining Ghost’s former sidebar layout did not satisfy the requested Screenpipe visual match. Keep Ghost’s real routes and actions instead of adding unrelated Screenpipe features.

- **2026-10-17 — Approved next pass:** redesign Home into one focused workspace with compact suggestions and a lower composer; move sample statistics/activity into Activity. Replace Settings dialogs with a full-page sectioned settings surface and “Back to app.” Use Inter action titles/body, monospace inputs/metadata, and phosphor lime #C7FF3E on primary actions plus actual running/progress markers. *Why:* the user approved these recommendations to bring the content surfaces closer to Screenpipe while retaining all existing functionality. This supersedes the prior constraint to keep the Home section structure and purely monochrome actions.

- **2026-10-17 — User preference:** show saved workflows as cards rather than rows on Home and in the Workflows library. Keep the Screenpipe palette, lime primary actions and existing workflow controls. *Why:* the user prefers a card-based way to browse workflows; this supersedes the earlier list/table presentation while preserving the focused Home composer.

- **2026-10-17 — User refinement:** the entire library card opens its editor, while Run, Schedule and Delete remain independent controls. Promote the actual node count into a prominent top badge on Home/library cards. Long workflow editor descriptions start collapsed with a clear way to read the full text. *Why:* opening a workflow should be easy from anywhere on its card, and supporting text must not push the canvas out of view.

- **2026-10-17 — Native collapsed-sidebar correction, refined after user review:** on macOS use one full-width56px title bar above the workspace, with native window buttons and sidebar controls in the same row. Start both the240px sidebar and56px rail below it; remove the duplicate Home context glyph. *Why:* spacer-only clearance avoided overlap but left native controls straddling two surfaces and the rail looking disconnected. This supersedes the44px compact-only spacer. Keep native controls, persistent collapse, route state and native browser bounds intact.

- **2026-10-17 — Onboarding refresh:** apply the approved Screenpipe/lime direction to the welcome page. Use a compact neutral guide and a clearly labeled example workflow, with a single primary Get started action. Preserve Skip intro, the existing walkthrough, theme controls, routes and native titlebar. Keep the main action visible in the760×620 minimum desktop window.

- **2026-10-17 — Upstream integration at PR preparation:** preserve the newly merged local Screenpipe discovery pipe, AI formatting, progress stages, source references and automatic opening of the generated editor. Update current user-facing data-source labels to match this live path; older synthetic-discovery notes and screenshots below describe earlier development states.

- **2026-10-17 — Settings native-controls correction:** Settings must use the same56px macOS title bar and lower divider as the main workspace. *Why:* its previous40px strip left the native traffic lights visibly too close to the sidebar. Preserve the native button position and other platforms’ spacing.

- **2026-10-17 — Canvas creation controls:** use one plus button in the left canvas toolbar. It opens a compact dropdown with Add node and Add connection; only selecting an action opens its corresponding dialog. Remove the separate connections toolbar button. *Why:* creation choices should stay beside the canvas until the user chooses what to add.

- **2026-10-17 — Node selection:** in Select mode, one click anywhere on a node selects it; double-click opens its settings. Status badges follow the same rule. Preserve dragging and provide Space to select / Enter to open for keyboard users. *Why:* selecting a node for canvas actions should not interrupt the workflow with a dialog or recording route.

- **2026-10-17 — Template drafts:** opening a template creates an independent saved Draft with its own graph IDs. Draft edits save automatically and remain available under Workflows → Drafts after app restarts. Keep the source template reusable and unchanged. *Why:* exploring and editing a template must produce a recoverable workflow rather than a temporary session copy.

## 7. Design direction

Ghost / Blue is the current production system. Canonical tokens are `src/renderer/src/styles/tokens.css`, exposed as Tailwind utilities in `globals.css`. The approved composition and rationale are documented in `design-proposals/ghost-blue/DESIGN-SYSTEM.md`; sample records there are never injected into the app.

Use locally bundled Inter Variable for UI and JetBrains Mono only for code/JSON. Light canvas #FFFFFF, sidebar #F8F9FC, primary text #111B30. Dark canvas #10151E, sidebar #131923, panels #171D29, text #EDF1F9. Brand blue #3478F7; filled primary controls #2D6DE0 with white labels. Blue selection tint, focus and action text follow semantic theme roles. Meaningful success/warning/error use icon plus text. Spacing follows4px increments; controls40px, cards12px corners, dialogs16px. No inset window frame.

Home has a readable composer and compact recent cards; activity remains available through disclosure. Workflows uses collection cards with prominent node counts and separate Run/Schedule/Delete controls. The editor uses React Flow, a compact header, collapsed description, plus dropdown, right-side inspector and existing run logs/results. Settings uses the shared workspace shell and three categories of actual settings. Teaching keeps the real native browser dominant, with recording controls below and actions beside it or available from a compact-screen dialog.

Preserve native bounds observation and browser occlusion under dialogs/Settings. Saved workflows keep their existing schema and coordinates. New template drafts use a readable vertical graph and retain durable autosave/recovery.
