## 1. Product purpose

Ghost turns repeatable computer routines into workflows that people can inspect, teach through a browser recording, test, and run.

## 2. Primary user

Proposed audience: a person doing repeated operations or reporting work on a desktop or laptop, moving between describing a routine, reviewing its steps, and checking the result. Specific job roles remain to be validated.

## 3. Three to five principles

**Current direction · 2026-10-17.** The user requested a Screenpipe-aligned reskin and supplied 39 desktop reference captures. This supersedes the earlier Ghost / Air palette and decorative treatment; preserve the existing app behavior and Ghost identity.

1. **A workflow starts with the routine.** Give describing work the strongest position on Home; keep statistics and setup secondary.
2. **Show readiness before execution.** Keep Draft, Needs teaching, Recorded, Learned, and Ready visibly distinct; preserve the difference between local validation, browser replay, and processing execution.
3. **Keep the work open.** Use desktop width for persistent navigation, readable workflow cards, and the workflow canvas. Reveal editing detail on demand rather than putting every setting on Home.
4. **Use contrast to direct the next action.** Follow Screenpipe’s neutral palette, thin boundaries and compact typography. Use phosphor lime for the primary action and genuine execution feedback; preserve explicit status labels, with restrained red for errors.
5. **Label what is demonstrated.** Synthetic discovery, illustrative activity, and sample metrics must be named as such. A preview must never imply a live connection or completed execution.

## 4. Success metric for the surface

Proposed acceptance target: a first-time user can identify how to describe a routine and open an existing workflow within 30 seconds. On a workflow, the user can identify the next required teaching or configuration step before choosing to run it; this is a target for later usability validation, not a measured result.

## 5. Out of scope

- Adding capabilities or changing workflow execution semantics as part of the visual migration.
- Changing recording, replay, processing, persistence, or scheduling behavior.
- Adding production integrations, new metrics, account systems, or navigation destinations; preview navigation labels are proposals for existing flows.
- Replacing the Ghost name or vector logo.
- Treating the preview's sample records as saved user data.

## 6. Learned constraints

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

## 7. Design direction

Use Inter for body, navigation, titles and instruction content; JetBrains Mono for controls, inputs and operational metadata. Both fonts are bundled. The dark canvas is #0A0A0A with #141414 work surfaces, #333333 separators and an opaque #31332E sidebar derived from the reference captures. Light uses Screenpipe’s #F6F6F3 canvas, #EFEFEB sidebar and white work surfaces. Primary actions use phosphor lime #C7FF3E with near-black ink in both modes. Neutral navigation and status semantics remain distinct; light-mode execution text uses a darker olive for contrast. Controls use 6px corners, cards 8px and dialogs 10px. Keep surfaces flat, reserving shadow for dialogs and transient overlays. The slim active-navigation marker is the shared signature detail.

Canonical tokens remain in `src/renderer/src/styles/tokens.css`, bridged through Tailwind v4 in `globals.css`. Preserve all routes, state, native browser bounds and actions. `design-preview/` is a historical Air mockup; current reference captures live under `.ui-craft/screenshots/screenpipe-*`.
