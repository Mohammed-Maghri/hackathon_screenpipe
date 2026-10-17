# Ghost / Blue tokens

Approved and implemented2026-10-17. Supersedes the historical Screenpipe/lime system. Canonical source: `src/renderer/src/styles/tokens.css`. Production components use Tailwind v4 utilities via `globals.css`; raw CSS is limited to tokens, native integration, React Flow paint and loading keyframes.

## Three-layer contract

Primitives (neutral/blue/status ramps, spacing, radius, typography) → theme-specific semantic roles → shared component contracts. Legacy application token names remain aliases so existing execution and recording surfaces keep working.

| Role | Light | Dark |
|---|---|---|
| Canvas | #FFFFFF | #10151E |
| Sidebar | #F8F9FC | #131923 |
| Panel | #FFFFFF | #171D29 |
| Sunken | #F0F2F6 | #202735 |
| Text | #111B30 | #EDF1F9 |
| Secondary | #606B7E | #A5AFC1 |
| Subtle border | #E5E8EF | #2B3444 |
| Control border | #8792A6 | #768299 |
| Brand blue | #3478F7 | #3478F7 |
| Filled primary | #2D6DE0 / white | #2D6DE0 / white |
| Primary hover | #245CC2 | #245CC2 |
| Action text | #245CC2 | #80ADFF |
| Selected tint | #F1F6FF | #192940 |
| Focus | #3478F7 | #80ADFF |
| Success | #25734E | #80CDA6 |
| Warning | #966000 | #EDBF74 |
| Error | #BA384C | #FF9AAA |

Inter Variable400/500/600 is bundled and used for UI, inputs and buttons. JetBrains Mono Variable is reserved for code, JSON and technical output. Body14–16px, labels14px, captions12px, section20px, title32px, display48px. Use tabular numbers for dates, counts and operational values.

| Component | Contract |
|---|---|
| Controls |40px standard height;8px radius; plain sans labels |
| Cards / graph nodes |12px radius;1px border; light layered shadow on interaction |
| Dialogs |16px radius; native modal focus and browser occlusion; layered shadow |
| Sidebar |248px,224px below1200px,72px compact/below1024px;40px navigation |
| Native chrome |56px full-width macOS row;112px controls reserve |
| Canvas |React Flow20px dots; themed handles/edges; blue selected/focus state |
| Motion |140–180ms feedback; reduced-motion support; no idle decoration |

Light, Dark and System preferences persist locally. System follows OS changes live. Theme initialization runs before first paint. Electron host backing matches #FFFFFF/#10151E; embedded websites retain their own appearance. No runtime font network requests.

Spacing uses4px increments:4/8/12/16/20/24/32/40/48/64/80. Approved preview/spec: `design-proposals/ghost-blue/`. Production acceptance and migration notes: `.ui-craft/surfaces/blue-migration.md`.
