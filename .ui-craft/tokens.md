# Ghost / Screenpipe design system

Current production direction, 2026-10-17. Canonical values live in `src/renderer/src/styles/tokens.css`; `globals.css` exposes semantic Tailwind utilities and shared component recipes. This supersedes the earlier Air visual system.

## Reference and type

The user supplied 39 Screenpipe desktop screenshots. Verified against Screenpipe’s [root layout](https://github.com/screenpipe/screenpipe/blob/main/apps/screenpipe-app-tauri/app/layout.tsx), [theme](https://github.com/screenpipe/screenpipe/blob/main/apps/screenpipe-app-tauri/app/globals.css), and [Tailwind configuration](https://github.com/screenpipe/screenpipe/blob/main/apps/screenpipe-app-tauri/tailwind.config.ts).

Inter Variable serves content, navigation, headings and node instructions. JetBrains Mono Variable serves inputs, buttons, labels, numeric values and diagnostics. Both are local font packages, without runtime font requests to external hosts. Native sans and mono fallbacks remain available. Body14px, captions12px, panel titles16–20px, page titles24px; Welcome uses32–40px. Use sentence case and tabular numerals.

## Primitive → semantic tokens

| Role | Light | Dark |
|---|---|---|
| Canvas | #F6F6F3 | #0A0A0A |
| Sidebar | #EFEFEB | #31332E |
| Panel / overlay | #FFFFFF | #141414 |
| Muted | #EFEFEB | #242424 |
| Raised | #FFFFFF | #292929 |
| Primary text | #0A0A0A | #F5F5F5 |
| Secondary text | #666666 | #A3A3A3 |
| Subtle border | #DEDED8 | #333333 |
| Control border | #888888 | #737373 |
| Filled action / label | #C7FF3E / #0A0A0A | #C7FF3E / #0A0A0A |
| Action hover | #B7EB36 | #B7EB36 |
| Action boundary | #647C21 | #C7FF3E |
| Live execution marker | #4F6A12 | #C7FF3E |
| Live execution tint | #EEF6D6 | #222B12 |
| Active navigation | #DEDED7 | #3C3E39 |

The warm opaque sidebar reproduces the captured native tint without introducing vibrancy or changing guest browser composition. Ready/warning states use neutral labels plus icons/dots. Error/destructive states retain subdued red for meaning. Historical pastel aliases now map to neutral surfaces. Lime is reserved for the screen’s primary Run/Generate action and genuine execution progress. Navigation, saved workflow statuses and configuration-only actions stay neutral. Light-theme execution text uses dark olive for contrast; filled lime buttons always use near-black labels. There is no blue interaction accent.

## Component tokens

| Component | Contract |
|---|---|
| Controls | 40px primary height, 6px radius, mono labels. `bg-action-fill text-on-action` for filled actions. |
| Cards / nodes | 8px radius, 1px separator, no decorative shadow. |
| Dialogs | 10px radius, layered overlay shadow, native dialog behavior. |
| Focus | 2px foreground outline with 3px offset; composer uses wrapper focus. |
| Navigation | Neutral selected surface, slim foreground marker, `aria-current`. |
| Layout | Full native window, no inset border/radius/shadow. 240px sidebar with responsive rail; 64px header baseline. |
| Canvas | Subtle 16px dot grid; selected border foreground; runtime geometry unchanged. |
| Motion |120/180/240ms, ease-out; no idle decoration; reduced-motion support. |

Spacing remains a 4px scale: 4/8/12/16/20/24/28/32/40/48/64. Legacy `air-` token names remain stable for consumers, with new values 4/6/8/10/12px; they do not override Tailwind’s built-in radius scale. Repeated recipes use `rounded-control`, `rounded-card`, `rounded-dialog`; shadows apply only to overlays.

## Appearance and native integration

Light, Dark and System preferences persist locally. System follows live OS changes. The external `theme-init.js` applies the saved mode before renderer paint. Native host backing matches the canvas (#F6F6F3 / #0A0A0A); appearance IPC does not modify Electron’s global nativeTheme or embedded websites. Recorder bounds, dialogs and browser lifecycle remain unchanged.

The original `design-preview/` is historical. Current screenshots are `.ui-craft/screenshots/screenpipe-*`.


## Sidebar reference correction

The sidebar follows the main Screenpipe app captures rather than the older Ghost composition: 240px expanded width, 32px utility toolbar, 56px section header, six 32px navigation rows with 2px gaps, Recents with 28px rows, and an 80px bottom footer. Navigation/recents use Inter at 13/12px. Dark sidebar ink is #F5F5F5, muted #B1B2B0, divider #41433F, selected fill #3C3E39, selected border #50514D and indicator #B8B8B8. Footer Settings/help remain reachable when the middle section scrolls. Collapsing the rail persists locally; responsive icon mode preserves accessible labels. The route labels and workspace actions remain Ghost’s actual functions. Recent entries come from saved workflows and local drafts; reference screenshots’ private chat titles are never copied into app content.

## Focused Home and full-page Settings

Home uses one centered, scrollable grid of workflow cards with compact sans task chips and a lower composer that stays available in short windows. Synthetic overview metrics and activity live in the Activity panel with their sample-data disclosures. Settings uses its own 240px sidebar, Back to app, search and sectioned rows for real existing app information and appearance controls. The originating route remains mounted and inert behind Settings; native teaching browsers are detached while covered and reattached to the same session on return.

Workflow browsing uses neutral 8px cards with16px padding, a12–16px grid gap, clamped title/description, app marks and operational metadata. Home has two columns above700px and one below; the library adapts one to three columns. Run/schedule/delete remain separate controls in library cards.

Workflow cards use a native stretched editor link with separately positioned action controls, retaining keyboard focus and modifier-link behavior. The actual node count sits in a high-contrast neutral top badge; lime remains reserved for primary actions and live execution. Long editor descriptions default to a compact disclosure so the canvas stays prominent.

macOS workspace routes share one full-width56px native title bar. Traffic lights retain their native25px/22px position; the collapse/menu controls occupy a slot after112px of clearance. The sidebar starts at56px in both expanded and compact modes. Home has a plain text context label. Other platforms retain their existing window controls and toolbar composition. Fixed workspace pages use an explicitly positioned route container, preserving native guest viewport measurements without transforms.

Settings matches the workspace’s56px macOS title bar, including its lower divider and full-height drag region. Its sidebar and Back to app row begin below that bar. Windows/Linux retain their40px Settings strip.
