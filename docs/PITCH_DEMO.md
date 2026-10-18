# Prepared pitch workflows

Prepared workflows are the default Home discovery configuration, with no mode switch in the UI. Submit a request directly. Prepared workflows save on this device in versioned local storage. No backend is required for creation, listing, reopening, editing or deletion. Live backend workflows remain unchanged and are available when live discovery is configured. Local prepared workflows are not synchronized to the backend.

Demo discovery uses prepared local definitions; it does not query Screenpipe or AI. The live activity timeline is disabled in this mode. Set `VITE_GHOST_DISCOVERY_MODE=live` and restart the development server or rebuild to restore normal discovery.

- NOVA: “Check sales and inventory and prepare next week's shopping list.”
- Forma: “Review overdue payments and prepare a finance report.”

Keyword matching tolerates common one-character typos in longer words. Ambiguous or unrecognized requests offer a NOVA/Forma choice. The original request is retained on every node.

Each board contains five nodes: prepared Screenpipe discovery context, a browser download task, report review, human approval, and a Slack message preview. The first node represents Screenpipe's role in finding a routine in recorded history; it does not claim that a search occurred during the demo. Evidence IDs remain empty.

These are saved draft boards, not a fully connected runner. Teach the browser task before replaying it. NOVA opens `https://hackathon-screenpipe.vercel.app/nova/restocking`. Existing prepared NOVA nodes using the old port-3104 default are migrated to this hosted URL; custom URLs are preserved. Forma uses the hosted finance page. NOVA calculates the reference restocking Excel itself. Automatic scheduling, Ghost-side restocking calculations, approval orchestration, and actual Slack delivery are not supplied by this demo.

Validation: root TypeScript/build passed. `node scripts/check-demo-discovery.mjs` passed an isolated Electron test covering typo matching, ambiguous selection, five-node graph validation, original prompt retention, local creation and reopening after reload. Its deliberately unavailable API fixture observed zero backend/Screenpipe/AI requests. The local storage suite also covers update, delete, filtering, quota failure and preservation of corrupt data. This does not verify a real history search or live Slack delivery.

Submitting a prepared request opens the actual workflow editor immediately after the local save. Its real nodes and edges reveal in place; no separate presentation canvas is mounted. Each step shows a thinking state, reveals its empty card, draws the incoming arrow into that card, then reveals its application image and text, taking about five seconds per node. The first step has no incoming arrow. The completed board retains application images. Show all steps skips the reveal; reduced-motion settings shorten it. This is a presentation of a prepared definition, not a claim that AI or website actions ran.

The thinking indicator stays visible throughout the node, logo, text and connection reveals. It is concurrent preparation feedback on the same canvas, not a separate loading screen or a claim of a live AI request.
