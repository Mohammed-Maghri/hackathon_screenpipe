# Onboarding — Screenpipe / lime

The user requested a new onboarding design after approving the main app's Screenpipe palette, typography and lime accent. The Welcome route remains a single introduction with the same entry actions; this is not a new setup wizard.

## Composition

- Full-width56px native title bar above both panes, with the existing Skip intro action and actual platform window controls.
- Neutral300px introductory rail,260px below1280px. Ghost identity, the existing “Your work, understood” message, and three static explanatory stages: describe, teach, review/run. These stages are not fake navigation or completion indicators.
- Main content uses a readable760px maximum width including padding,32–40px heading and Inter body text. A clearly labeled example workflow shows three connected nodes on the same dot canvas used by the editor. It has no fake run state or clickable-looking controls.
- Get started remains the single lime action. See how it works opens the existing native walkthrough dialog. Both original entry paths navigate to Home.
- Appearance controls and version stay in a persistent footer. Light/Dark/System persist through the existing appearance store.
- Below900px the rail gives way to a single content column. Below600px the example nodes stack vertically. Short windows reduce spacing and hide the duplicate content logo so the CTA remains visible at760×620. Content scrolls independently from the footer; no outer window frame, transform or native browser changes.
- After integrating the latest base branch, the page asks the user to connect Screenpipe to discover routines. It does not imply that a connection is already active. Earlier captures with synthetic-discovery copy predate this integration.

## Validation

Production build/typecheck, scoped token lint and whitespace checks pass. Scoped token lint has zero findings before/after; a standalone ui-craft detector executable is unavailable locally, so no detector score is claimed.

Headless checks cover Light/Dark at1440×960,1280×800,1024×768,1024×620,900×620,760×620,390×844 and320×640. They verify full-bleed bounds, no horizontal overflow, primary CTA visibility at desktop sizes, walkthrough open/Escape/focus return/start, direct Get started, Skip intro, appearance persistence and zero page errors. The existing Electron UI smoke also passes welcome/dialogs, drafts/editing, templates, appearance and Settings state retention.

Current previews: `.ui-craft/screenshots/screenpipe-onboarding-{dark,light}-{width}.png`. The example is illustrative, not saved workflow data. Renderer screenshots exclude native traffic-light pixels.
