# Ghost UI constraints

Current source of truth: the implemented app and `src/renderer/src/styles/tokens.css`.

- Preserve Ghost's name and vector mark, the blue accent, and Light/Dark/System appearance. Historical lime and Air proposals are superseded.
- Use the existing bundled typography and semantic tokens. Keep control icons consistent and application marks crisp, recognizable SVGs.
- Content fills the native window. Use real macOS traffic lights with a 56px title bar and 112px left reserve; do not draw an inset fake window.
- Preserve the native teaching browser's bounds tracking, modal occlusion, context isolation, saved recordings and replay behavior.
- Preserve React Flow node/edge identities and configurations. One click selects a node; double-click opens its settings.
- Home shows a compact workflow list; full search/filtering belongs on Workflows. Keep rows within their panel, with scrolling when needed.
- Workflow cards open the editor; Run, Schedule and Delete remain independent actions. Long descriptions start collapsed.
- Keep prepared demo context distinct from live recorded evidence. Do not present sample metrics or teaching as a completed run.
- Verify compact layouts down to the native 760×620 minimum, both themes, and reduced motion.

Retired previews and screenshot archives have been removed; use the current app for visual review.
