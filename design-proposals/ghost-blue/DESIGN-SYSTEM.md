# Ghost / Blue — Design specification

Status: **proposal for review; application implementation is not authorized by this task.**

## Direction

Ghost should feel understandable before it feels powerful. A person should know where to start, what to review, and what will happen when they press Run.

The supplied Noera references provide the visual direction: airy surfaces, deep navy text, readable sans typography, soft boundaries, restrained rounding, and a precise blue accent. Ghost retains its name, ghost-shaped vector, workflow concepts, and existing capabilities. Chat content, avatars, an account system, and upgrade prompts from the reference are not copied into the product.

This is a layout rebuild proposal. Current routes, data models, recording lifecycle, workflow execution, and persistence remain the authority for later implementation.

| Principle | Design consequence |
| --- | --- |
| Start with a task | Home centers the routine composer. No decorative dashboard metrics. |
| One primary action per context | Find my workflow on Home; New workflow in the library; Run workflow in the editor. |
| Reveal detail when useful | Long descriptions, node settings, logs, advanced configuration, and destructive actions do not compete with the canvas. |
| Keep navigation predictable | The same shell surrounds Home, Workflows, and Settings. Recents are shortcuts, not another hierarchy. |
| Use color for a reason | Blue means action/selection/focus. Semantic statuses include explicit labels and icons. |
| Preserve the work | Existing drafts, recordings, templates, recovery, and backend behavior must survive any later UI migration. |

Craft level 8; motion 2; density 3 on Home, 4 in the library, 5 in the editor; variance 4. Signature: a quiet sidebar with a consistent pale blue selection state.

## What changes structurally

| Surface | Current issue | Proposed hierarchy |
| --- | --- | --- |
| Shell | Heavy sidebar, repeated context, mixed typography | Native title bar → brand/search → two primary destinations → recents → settings/help/local workspace |
| Home | Several actions and metadata compete | One welcome → composer → examples → two compact recent cards |
| Workflows | Dense controls and equally loud card details | Title/action → four filters → search/view tools → cards with nodes/status first |
| Editor | Description and action rows push down the graph | Compact title/action → readiness + collapsed description → tabs → canvas; details in inspector |
| Teaching | Controls and explanatory copy compete with browser | Browser is dominant; guide beside it; recording controls below it |
| Settings | Separate visual shell, boxed rows, repeated headings | Familiar shell → three categories → narrow reading width → plain related rows |
| Introduction | Too much explanation before the first task | One promise → three concrete steps → one next action |

All existing routes remain available. Tabs and action placement can change; capability removal is out of scope. The new Settings layout replaces the dedicated settings sidebar with three top-level categories, retaining return-to-previous-work behavior.

## Foundations

### Color

The most frequent saturated blue sampled from reference 2 is **RGB 52, 120, 247 / #3478F7**. This is the brand and selection accent. A deeper same-hue shade, **#2D6DE0**, is used behind small white action labels: contrast is **4.80:1** versus white; the exact reference blue is only 4.06:1.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | #FFFFFF | #10151E |
| Sidebar | #F8F9FC | #131923 |
| Raised surface | #FFFFFF | #171D29 |
| Subtle region | #FCFCFD | #131923 |
| Sunken/hover | #F0F2F6 | #202735 |
| Primary text | #111B30 | #EDF1F9 |
| Secondary text | #606B7E | #A5AFC1 |
| Subtle border | #E5E8EF | #2B3444 |
| Control boundary | #8792A6 | #768299 |
| Brand blue | #3478F7 | #3478F7 |
| Action fill | #2D6DE0 | #2D6DE0 |
| Action hover | #245CC2 | #245CC2 |
| Link/selected label | #245CC2 | #80ADFF |
| Selection surface | #F1F6FF | #192940 |
| Success label | #25734E | #80CDA6 |
| Teaching/warning label | #966000 | #EDBF74 |
| Error label | #BA384C | #FF9AAA |

Use neutral surfaces for at least 90% of the view. Limit blue to primary actions, active navigation/tabs, focus, and selected nodes. Status colors are semantic and never used as decoration. Remove all lime from this proposed system.

Dark mode is a separate surface hierarchy, not a color inversion. Raised panels are lighter than the canvas. Borders carry elevation when shadows become ineffective. Light, Dark, and System are first-class choices; System follows live OS changes. Native controls and menus inherit `color-scheme`.

### Typography

**Inter Variable** is the single UI family. Its open forms and generous x-height work well for the reference's calm, readable interface and for compact editor labels. Reusing the bundled font avoids another network font dependency. The improvement comes from the hierarchy, weight, and removal of pervasive monospace controls, rather than adding a decorative typeface.

Use regular 400 for text/display, medium 500 for titles/labels, and semibold 600 only for small emphasis. Avoid bold oversized headings. Monospace is reserved for code, JSON, IDs, and technical values; shortcuts can remain in the UI family.

| Role | Size / line height | Weight | Tracking |
| --- | --- | --- | --- |
| Welcome/display | 48 / 1.12; 36–40 in compact windows | 400 | −0.04em |
| Page title | 32 / 1.2; 28 in compact windows | 500 | −0.035em |
| Section heading | 20 / 1.4 | 500 | −0.025em |
| Body/composer | 16 / 1.5 | 400 | Normal |
| Navigation/control/card title | 14 / 1.4–1.5 | 400–500 | Normal |
| Supporting metadata | 12 / 1.5 | 400 | Normal |

Brand lettering and the large “Aa” specimen are intentional display exceptions, not additional application text levels. Use tabular figures for node counts, times, pagination, and run durations. Use sentence case. Keep prose at 45–75 characters per line. Never shrink operational controls below 12 px to fit extra actions.

### Space, shape, depth

- Spacing: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px**. Four-pixel base; most layout grouping uses 8 px increments.
- Group spacing must satisfy: within a group < between groups < between sections.
- Default page gutter 48 px, compact 32/24 px. Editor gutters 20–28 px are deliberate space-saving exceptions.
- Sidebar 248 px, 224 px below 1200; compact rail 72 px. Navigation targets 40 px tall, 44 px for coarse pointers.
- Native title bar **56 px, full width**, above both content and sidebar. Reserve the first **112 px** for native macOS traffic lights; put the collapse control after that reservation. Do not add custom traffic lights, a duplicate title bar, an outer inset frame, or a CSS window shadow.
- Corners: 6 px small controls; 8 px buttons/inputs/nav; 12 px workflow/node cards; 16 px composers/dialogs.
- Cards: one thin structural boundary. No colored top stripe, repeated glows, gradients, or large hover movement.
- Elevation: restrained ambient + direct shadow for composers and overlays in light mode; a subtle light ring and boundary in dark mode.
- Lucide icons throughout, generally 16–18 px and 1.7 stroke. The original Ghost vector remains the brand mark. Generic app glyphs in this proposal are placeholders for the app's existing application marks.

## Navigation and layout contracts

### Shell

```text
native title bar (56 px, full width; safe macOS controls)
┌────────────────────┬─────────────────────────────────────┐
│ Ghost              │                                     │
│ Search anything ⌘K │ Current surface                     │
│ Home               │                                     │
│ Workflows          │ One heading, one primary action     │
│                    │                                     │
│ Recent workflows   │ Content sized to the task           │
│ Browse templates   │                                     │
│                    │                                     │
│ Settings / Help    │                                     │
│ Personal workspace │                                     │
└────────────────────┴─────────────────────────────────────┘
```

Search is a utility; Home and Workflows are the only main destinations. Avoid empty nav destinations or platform features the product does not have. No fabricated avatar/account menu. “Personal workspace” describes the existing local app.

At 1023 px and below, collapse to the icon rail. Below the supported desktop minimum, allow content to scroll and retain reachable controls rather than pretending this is a complete mobile application. All icon navigation requires accessible labels and visible right-hand hints on hover/focus. Store the collapsed state separately from theme.

### Home

```text
Home                                          Help

                  restrained workflow mark
                    Your work.
                 A little less busy.
             one sentence explaining the task

           ┌────────────────────────────────┐
           │ Describe the routine           │
           │                                │
           │ Source/range       Find →      │
           └────────────────────────────────┘
             two examples · Record a routine

Pick up where you left off                    All →
┌──────────────────────────┐ ┌──────────────────────────┐
│ nodes             status │ │ nodes             status │
│ name · apps              │ │ name · apps              │
│ edited       run/…       │ │ schedule       run/…     │
└──────────────────────────┘ └──────────────────────────┘
```

Keep the composer around 760 px wide. Its primary action uses a text label plus arrow. Examples fill the composer rather than launching automation. Source and time range belong behind one low-weight source control. Show two recent cards on desktop; the full library is one link away. Do not repeat activity statistics on Home.

Preserve the real Screenpipe discovery request, progress phases, retry/recovery, references, automatic editor opening, create/import/refresh actions, and notifications. Secondary utilities can move into the library/menu; they cannot disappear.

### Workflow library

- Header: title/context on the left, New workflow on the right.
- Filters: All workflows, Drafts, Scheduled, Templates. These are filters, not separate page hierarchies.
- Search and optional card/list control form one compact toolbar. Card view is the default.
- Cards: node count first, readiness second, concise name, description capped at two lines, source apps, then edit/schedule context and independent action controls.
- The entire card opens the editor. Run, Schedule, and Delete are sibling controls above the card link; they never bubble into opening the editor.
- Run and Schedule retain readiness validation. Draft/incomplete workflows cannot silently execute in the real app.
- Delete asks for confirmation naming the workflow. Undo can replace confirmation only if full recovery exists.
- A template creates a new persistent Draft with independent graph IDs. Edits autosave; the source remains reusable. The draft appears immediately and after restart. The preview demonstrates the layout, not backend persistence.

### Editor

```text
← Name + save state                          Share  Run  …
  readiness · About this workflow ⌄
Canvas    Steps    Runs    Activity    Settings
┌────────────────────────────────────────┬────────────────┐
│ [Select]                               │ Node settings  │
│ [+]       trigger                      │ (when opened)  │
│ [Copy]       │                         │                │
│ [Delete]  browser step                  │ Name           │
│              │                         │ Instruction    │
│           action                       │ Teach step     │
│              │                         │ Connections    │
│           browser step                 │                │
│                                        │                │
│ Zoom − 100% +              Run log ⌄    │                │
└────────────────────────────────────────┴────────────────┘
```

- Title, draft/save state, Share, Run, overflow fit one compact header group. Autosaving is explicit; errors cannot look like saved success.
- Long descriptions begin collapsed. Expanding them is deliberate and reversible.
- Keep Canvas, Steps, Runs, Activity, Settings. Inputs/outputs move into workflow settings; test-run configuration can be reached from Run options without a second equal-weight primary action.
- One click selects a node; double click opens the settings inspector. Space selects, Enter edits. Selection never launches recording.
- Preserve pan, drag, graph data, branches, condition editing, selection deletion/duplication, zoom, and bounds behavior. The prototype graph is a fixed sample sequence and does not implement these graph semantics.
- A **plus** opens a small adjacent menu: Add node / Add connection. Only the chosen action opens a dialog. No separate connection tool in the toolbar.
- Right-hand tooltips appear on hover and keyboard focus. Disabled operations explain that a node must be selected.
- Inspector width 312 px, 280 px in intermediate windows. At the compact minimum it overlays the canvas with a clear close control, rather than crushing the graph. Fields use visible labels and contextual help.
- Logs are an optional bottom panel. Clear removes run logs/test results; it never removes nodes, edges, recordings, or workflow definitions.
- Run history and workflow activity use explicit time/source context. No invented execution successes or metrics.

### Teaching

The embedded browser is the main work surface. Keep URL/navigation controls above it, record/stop/review controls below it, and a short three-step guide beside it. The guide becomes a compact horizontal block or disclosure in small windows. Never obscure the recording state.

Later implementation must preserve Electron BrowserView/WebContentsView positioning, viewport measurement, resize observation, session recovery, IPC, recording actions, replay, and native browser occlusion under dialogs or Settings. The design preview contains no embedded browser and cannot validate those behaviors.

### Settings

Keep the normal sidebar and native chrome. Use a readable central column (max 920 px including gutters), three categories, and spacing/dividers to group related rows. Avoid putting every row inside a separate outlined card.

General contains version/introduction/help. Appearance contains Light/Dark/System and compact navigation. Workspace explains data source, backend-saved workflows, and template drafts without pretending to offer controls the app does not have. Read-only values look read-only. Show automatic preference saving without requiring a redundant Save button.

The typography description in the preview explains the proposal; it is not a new font-size setting. Review-only explanations should not become product controls during implementation.

### Introduction

One short promise, three steps (Describe, Review/teach, Test/run), one primary continuation, and a low-weight Skip introduction. Keep the first useful action reachable at the minimum native window size. Avoid a marketing landing page, statistics, integrations wall, or mandatory multi-screen tour.

### Search

⌘/Ctrl+K opens a focused, keyboard-reachable native dialog. A large search field precedes compact categories and grouped results. Workflows show name, node count, readiness. Quick actions are separate. Escape closes; focus returns to the trigger. Empty results give a specific next step. The preview searches example workflow names/descriptions and demonstrates action categories only; app-wide indexing is not claimed as an implemented capability.

## Components and interaction rules

| Component | Contract |
| --- | --- |
| Primary button | 40 px height, blue action fill, white label, one per context; explicit pending label and `aria-busy` |
| Secondary button | Defined neutral boundary; readable label; hover/focus makes the action clearer |
| Tertiary action | Text/icon, lower hierarchy; inline prose links remain underlined |
| Icon control | Accessible name and useful tooltip; 36 px desktop target, 44 px touch; no mystery glyphs |
| Input | Visible label, 40 px height, persistent hint, focused boundary/ring, inline validation |
| Card | Concise title, clear click target, independent action siblings, whole-card focus ring |
| Status | Icon + label, semantic color only; distinguish Draft/Needs teaching/Ready and actual Recorded/Learned states where applicable |
| Dialog | Native `<dialog>` or established accessible equivalent; trapped focus, Escape, trigger restoration, clear title/action |
| Add menu | Anchored to plus; keyboard reachable; Escape/outside click dismisses; selected action opens its own dialog |
| Inspector | Non-modal detail panel; explicit close; keep node selection separate from editing |
| Toast | Polite announcement; short factual text; errors also have a persistent inline recovery path |
| Empty state | One reason + one useful action; no decorative illustration required |
| Skeleton | Same layout as the final region; avoid moving surrounding controls |

Motion is limited to approximately 140 ms color/boundary feedback and short disclosure transitions. No hover lift, idle animation, page choreography, or loading shimmer. Reduced-motion removes nonessential transitions. Theme changes must not flash white before the saved preference resolves in a later production implementation.

## State matrix for later implementation

| Surface | Loading | Empty | Error/offline | Partial/conflict | Success |
| --- | --- | --- | --- | --- | --- |
| Home discovery | Label current real progress stage; prevent duplicate requests | Helpful prompt/examples | Keep prompt, show reason and retry | Cite evidence gaps; never imply inferred steps are recorded | Open generated draft, announce completion |
| Library | Card-shaped skeletons | Create workflow / clear search, contextually | Keep cached cards where available; Retry | Show unknown counts as unknown; avoid duplicate imported IDs | Newly saved draft appears immediately |
| Editor save | Saving… near title | Clear first-step affordance | Unsaved locally / retry; preserve graph | Explicit conflict/reload/copy path, no silent overwrite | Saved indicator after server acknowledgement |
| Node teaching | Recording state and elapsed time | State how to begin | Permission/browser/session recovery | Mark incomplete recording and allow resume/re-record | Actual Recorded/Learned readiness reflects runtime |
| Run | Real per-step progress + Stop where supported | No runs yet | Name failed step + inspect/retry | Report skipped/unknown steps honestly | Real outcome, duration, outputs |
| Settings | Keep shell stable | Not applicable for fixed local preferences | Explain unavailable backend/native settings | Retain stored preference on write failure | Preference applied, persisted, announced when useful |

The Foundations page visually demonstrates loading/empty/error and normal component states. Other runtime conditions above are specifications, not simulated claims of working backend behavior.

## Accessibility and compact windows

- All actions are reachable by keyboard; inputs have labels, not just placeholders.
- Use a visible 2 px blue focus outline with offset. Composite inputs expose a visible group focus ring.
- Page navigation moves focus to the content region; dialogs trap/restore focus.
- Small text must reach 4.5:1; large text and meaningful component boundaries 3:1. Check semantic colors against their actual surfaces in both themes.
- Selection/status cannot depend only on color. Use `aria-current`, `aria-pressed`, `aria-checked`, and explicit text where appropriate.
- Respect reduced motion and live OS theme changes.
- Review at 1440×960, 1280×800, 1024×768, and the native 760×620 minimum. A 390 px browser viewport is a stress check only; this is a desktop product.
- At reduced height, collapse supporting decoration before shrinking text or moving the primary action out of reach. Support 200% text/zoom with scrolling.

## Preservation and implementation boundary

This folder is independent. There are no production imports, changed application tokens, modified routes, new backend endpoints, changed user records, or new runtime dependencies. The demo's review bar, sample labels, explanatory dialogs, and mocked results must never be copied into production as real features.

If the direction is approved later, implement in this order: semantic token mapping → typography → shared native shell → primitives → Home/library → editor/inspector → teaching → settings/welcome → real loading/error/conflict states. Use the existing React/Tailwind stack and existing state/IPC/API handlers. Map the proposed tokens into Tailwind; do not paste this self-contained preview into the app.

Before each screen migrates, capture its real behavior and verify it afterward. Required preservation checks include actual persisted template drafts after restart, independent card actions, node single/double-click and drag, connections/conditions, Clear results semantics, native title-bar spacing in both sidebar states, and recording/replay bounds with overlays. Backend/core tests and native Electron checks remain necessary at implementation time.

Craft Read: a workflow workspace for everyday automation, product language, light and dark with reference blue, variance 4, signature bet: a quiet sidebar with a clear blue selection state.
