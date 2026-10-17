/* Isolated design prototype. All interactions are local and use sample data. */
const paths = {
  ghost:
    '<path d="M4 10a8 8 0 0 1 16 0v11l-4-2-4 2-4-2-4 2Z"/><path d="M9 10v2m6-2v2"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  workflow:
    '<rect x="3" y="3" width="6" height="6" rx="2"/><rect x="15" y="15" width="6" height="6" rx="2"/><path d="M6 9v7a2 2 0 0 0 2 2h7M9 6h7a2 2 0 0 1 2 2v7"/>',
  record:
    '<rect x="3" y="3" width="18" height="18" rx="6"/><circle cx="12" cy="12" r="4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  plug: '<path d="m8 3 4 4m4-4-4 4m-6 3 8 8m-5-8-4 4a4.2 4.2 0 0 0 6 6l4-4m-9 3-4 4m10-13 3-3"/>',
  settings:
    '<path d="m9 3-1 3-3 1v4l-2 1 2 4 3 1 1 4h6l1-4 3-1 2-4-2-1V7l-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-9 12h6"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  chevrons: '<path d="m9 8 3-3 3 3m-6 8 3 3 3-3"/>',
  "arrow-up-right": '<path d="M6 18 18 6M6 6h12v12"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  "arrow-up": '<path d="M12 20V4m-6 6 6-6 6 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',
  screenpipe:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M20 4h.01"/>',
  sparkle:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Zm7-2v4m-2-2h4"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  more: '<circle cx="5" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="19" cy="12" r=".6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  file: '<path d="M14 3H5v18h14V8Zm0 0v5h5M8 13h8m-8 4h5"/>',
  mouse: '<path d="m5 3 14 10-7 1-3 7Z"/>',
  sliders:
    '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  save: '<path d="M4 3h13l3 3v15H4Zm4 0v6h8V3M8 21v-7h8v7"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  external: '<path d="M14 3h7v7m-9 2 9-9M10 5H4v16h16v-6"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5m-18 5 9 5 9-5"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.workflow}</svg>`;
const assetRoot = "../src/renderer/src/assets/app-imagery/";
const app = (name) =>
  `<span class="app-icon"><img src="${assetRoot + name.toLowerCase()}.svg" width="22" height="22" alt="${name}"></span>`;
const apps = (names) =>
  `<span class="app-stack">${names.map(app).join("")}</span>`;
const button = (label, ic = "", primary = false, attr = "") =>
  `<button class="btn ${primary ? "btn-primary" : ""}" ${attr}>${ic ? icon(ic) : ""}${label}</button>`;
const sample = '<span class="sample-label">Sample data</span>';
const workflows = [
  {
    name: "Daily Orders Report",
    desc: "From the orders dashboard to your team.",
    apps: ["Chrome", "Excel", "Slack"],
    state: "Needs teaching",
    steps: 3,
    updated: "2 hours ago",
    schedule: "Weekdays, 9:00",
  },
  {
    name: "Customer Follow-ups",
    desc: "A thoughtful follow-up, without the admin.",
    apps: ["Gmail", "Notion"],
    state: "Ready",
    steps: 3,
    updated: "Yesterday",
    schedule: "Daily, 10:00",
  },
  {
    name: "Update Documentation",
    desc: "Keep everyone on the same page.",
    apps: ["Chrome", "Notion"],
    state: "Ready",
    steps: 4,
    updated: "3 days ago",
    schedule: "No schedule",
  },
  {
    name: "Check Failed Payments",
    desc: "Find the exceptions that need attention.",
    apps: ["Slack", "Drive"],
    state: "Needs review",
    steps: 3,
    updated: "5 days ago",
    schedule: "No schedule",
  },
  {
    name: "Generate Monthly Report",
    desc: "Bring the month together in one report.",
    apps: ["Excel", "Drive"],
    state: "Draft",
    steps: 3,
    updated: "1 week ago",
    schedule: "No schedule",
  },
];
const stateClass = (state) =>
  state === "Ready"
    ? "success"
    : state === "Needs teaching" || state === "Needs review"
      ? "warning"
      : "neutral";
const badge = (state) =>
  `<span class="state ${stateClass(state)}"><span class="status-dot"></span>${state}</span>`;
let activeView = "home";
let activeFilter = "All workflows";
let selectedStep = 0;
let libraryQuery = "";
const view = document.querySelector("#view");

function home() {
  return `<div class="home-page page-content">
   <section class="home-intro"><div><p class="overline">A little space for what matters.</p><h1>Your work, a little lighter.</h1><p class="page-description">Turn the things you do on repeat into things that do themselves.</p></div><span class="today">Saturday, 17 October ${icon("down")}</span></section>
   <div class="home-columns"><div class="home-primary">
     <form class="composer" id="create-form"><div class="composer-title">${icon("sparkle")}<span>What would you like to automate?</span></div><label class="sr-only" for="workflow-prompt">Describe your workflow</label><textarea id="workflow-prompt" rows="2" placeholder="Every morning, collect my orders and prepare a report…"></textarea><div class="composer-footer"><button type="button" class="context-button" data-dialog="activity">${icon("clock")}Use recent activity ${icon("down")}</button><span class="composer-hint">Start with a simple routine</span><button class="send-button" aria-label="Create workflow preview">${icon("arrow-up")}</button></div></form>
     <div class="start-cards">
       <button class="start-card card-blue" data-action="describe"><span class="start-copy"><strong>Describe it.<br>We’ll map it.</strong><small>Start with your own words</small></span><span class="card-arrow">${icon("arrow-up-right")}</span><span class="art-map" aria-hidden="true"><i class="mini-node node-a">${icon("mouse")}</i><i class="mini-node node-b">${icon("file")}</i><i class="mini-node node-c">${icon("check")}</i><i class="mini-connector"></i></span></button>
       <button class="start-card card-peach" data-view="recording"><span class="start-copy"><strong>Show Ghost<br>how it’s done.</strong><small>Record a routine</small></span><span class="card-arrow">${icon("arrow-up-right")}</span><span class="art-record" aria-hidden="true"><span class="record-window"><i></i><i></i><i></i><b>${icon("mouse")}</b></span><span class="record-bubble">${icon("record")}</span></span></button>
       <button class="start-card card-lilac" data-dialog="templates"><span class="start-copy"><strong>A head start<br>on your next task.</strong><small>Explore templates</small></span><span class="card-arrow">${icon("arrow-up-right")}</span><span class="art-stack" aria-hidden="true"><i></i><i></i><i>${icon("bolt")}<b></b><b></b></i></span></button>
     </div>
     <section class="recent-section"><div class="section-heading"><h2>Pick up where you left off</h2><button class="text-btn" data-view="workflows">All workflows ${icon("arrow")}</button></div><div class="recent-list">${workflows
       .slice(0, 3)
       .map(
         (w, i) =>
           `<button class="recent-row" data-view="editor"><span class="workflow-glyph glyph-${i}">${icon(i === 0 ? "file" : i === 1 ? "activity" : "layers")}</span><span class="recent-copy"><strong>${w.name}</strong><small>${w.steps} steps <span>·</span> Edited ${w.updated.toLowerCase()}</small></span>${apps(w.apps)}${badge(w.state)}${icon("arrow-up-right", "row-arrow")}</button>`,
       )
       .join("")}</div></section>
     <div class="home-footnote">${icon("lock")}Your routines, your control. Review every workflow before running it.<span>${sample}</span></div>
   </div>
   <aside class="home-aside" aria-label="Workspace overview">
     <section class="time-card"><div class="time-card-title">Room for better things ${icon("sparkle")}</div><div class="ghost-scene" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="scene-dot dot-one"></span><span class="scene-dot dot-two"></span><span class="ghost-figure">${icon("ghost")}</span><span class="floating-check">${icon("check")}</span></div><div class="time-number">2h <span>40m</span></div><p>back in your day.</p><div class="time-divider"></div><span class="time-caption">Illustrative time saved this week</span></section>
     <section class="workspace-status"><div class="section-heading"><h2>Ready when you are</h2>${icon("bolt")}</div><div class="ready-line"><span class="status-dot success"></span><span>2 workflows ready</span><button class="icon-btn" data-view="workflows" aria-label="View ready workflows">${icon("arrow")}</button></div><div class="ready-line"><span class="status-dot warning"></span><span>1 routine to teach</span><button class="icon-btn" data-view="recording" aria-label="Teach a routine">${icon("arrow")}</button></div></section>
     <section class="activity-card"><div class="section-heading"><h2>Recent activity</h2><span class="sample-mini">Preview</span></div><div class="activity-item">${app("Chrome")}<div>Opened orders dashboard<small>Today at 10:24</small></div></div><div class="activity-item">${app("Excel")}<div>Exported orders.csv<small>Today at 09:52</small></div></div><button class="text-btn" data-dialog="activity">View activity ${icon("arrow")}</button></section>
   </aside></div>
 </div>`;
}

function workflowRows() {
  const rows = workflows.filter(
    (w) =>
      `${w.name} ${w.desc} ${w.apps.join(" ")}`
        .toLowerCase()
        .includes(libraryQuery.toLowerCase()) &&
      (activeFilter === "All workflows" ||
        (activeFilter === "Ready" && w.state === "Ready") ||
        (activeFilter === "Needs attention" && w.state.startsWith("Needs")) ||
        (activeFilter === "Drafts" && w.state === "Draft")),
  );
  return rows.length
    ? rows
        .map(
          (w, i) =>
            `<tr><td><button class="table-workflow" data-view="editor"><span class="workflow-glyph glyph-${i % 3}">${icon("workflow")}</span><span><strong>${w.name}</strong><small>${w.desc}</small></span></button></td><td>${apps(w.apps)}</td><td>${badge(w.state)}</td><td class="schedule-cell">${icon("clock")}${w.schedule}</td><td class="muted-text">${w.updated}</td><td><button class="icon-btn" data-view="editor" aria-label="Open ${w.name}">${icon("arrow-up-right")}</button></td></tr>`,
        )
        .join("")
    : `<tr><td colspan="6"><div class="empty-state">${icon("search")}<h2>No workflows found</h2><p>Try another name or clear your filters.</p>${button("Clear search", "", "", 'data-action="clear-search"')}</div></td></tr>`;
}

function library() {
  return `<div class="library-page page-content"><div class="page-heading"><div><p class="overline">Good routines deserve a home.</p><h1>Your workflows.</h1><p class="page-description">A little organization. A lot less repetition.</p></div>${button("New workflow", "plus", true, 'data-action="new"')}</div><div class="library-summary"><div><span class="summary-symbol">${icon("workflow")}</span><span><strong>5</strong> workflows in your space</span></div><span><i class="status-dot success"></i>2 ready to run</span><span><i class="status-dot warning"></i>2 need attention</span><span class="summary-note">${sample}</span></div><div class="library-toolbar"><div class="filter-tabs" aria-label="Filter workflows">${["All workflows", "Ready", "Needs attention", "Drafts"].map((f) => `<button data-filter="${f}" aria-pressed="${activeFilter === f}">${f}${f === "All workflows" ? "<span>5</span>" : ""}</button>`).join("")}</div><label class="table-search">${icon("search")}<input id="library-search" type="search" value="${libraryQuery.replaceAll('"', "&quot;")}" placeholder="Find a workflow…" aria-label="Find a workflow"><kbd>⌘ K</kbd></label></div><div class="table-container"><table><thead><tr><th scope="col">Workflow</th><th scope="col">Apps</th><th scope="col">Status</th><th scope="col">Schedule</th><th scope="col">Last edited</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody id="workflow-rows">${workflowRows()}</tbody></table></div><div class="library-footer"><span id="workflow-count">${workflows.length} sample workflows</span><span>${icon("lock")} Nothing runs without your review.</span></div><button class="new-routine-card" data-view="recording"><span class="new-routine-icon">${icon("record")}</span><span><strong>Some things are easier to show.</strong><small>Record your routine once. Give it back to Ghost.</small></span><span class="text-btn">Record a routine ${icon("arrow")}</span></button></div>`;
}

const steps = [
  {
    title: "Open orders dashboard",
    sub: "Browser action",
    app: "Chrome",
    desc: "Open the orders dashboard and collect today’s orders.",
    state: "Ready",
    details: "https://app.example.com/orders",
  },
  {
    title: "Prepare the report",
    sub: "Data processing",
    app: "Excel",
    desc: "Organize today’s orders into a clean summary.",
    state: "Ready",
    details: "orders.csv → daily-report.csv",
  },
  {
    title: "Draft team summary",
    sub: "Browser action",
    app: "Slack",
    desc: "Prepare a short summary for #reports. Review before sending.",
    state: "Needs teaching",
    details: "#reports · Draft message",
  },
];
function inspector() {
  const s = steps[selectedStep];
  return `<div class="inspector-top"><span>Step ${selectedStep + 1} of 3</span><span>${icon("sliders")}</span></div><div class="inspector-app">${app(s.app)}<span>${s.sub}</span></div><h2>${s.title}</h2>${badge(s.state)}<div class="inspector-rule"></div><label class="field-label" for="step-description">What this step does</label><textarea id="step-description" class="inspector-textarea">${s.desc}</textarea><div class="field-label">${selectedStep === 1 ? "Input → Output" : "Destination"}</div><div class="destination">${icon(selectedStep === 1 ? "file" : "external")}<span>${s.details}</span></div><div class="inspector-rule"></div><div class="field-label">Instructions</div><ol class="instruction-list">${(selectedStep === 0 ? ["Open the orders page", "Filter to today’s orders", "Export orders as a CSV file"] : selectedStep === 1 ? ["Read the exported orders", "Group orders by status", "Save a daily summary"] : ["Open the #reports channel", "Prepare the daily summary", "Keep the message as a draft"]).map((x) => `<li>${x}</li>`).join("")}</ol><div class="teaching-note">${icon(selectedStep === 2 ? "record" : "check")}<div><strong>${selectedStep === 2 ? "One quick demonstration." : "This step is ready."}</strong><p>${selectedStep === 2 ? "Show Ghost how you prepare this draft." : "Review the instructions before testing."}</p></div></div>${button(selectedStep === 2 ? "Teach this step" : "Review recording", selectedStep === 2 ? "record" : "play", selectedStep === 2, `data-${selectedStep === 2 ? 'view="recording"' : 'dialog="step-review"'}`)}<button class="text-btn inspector-save" data-action="save">Save step changes ${icon("check")}</button>`;
}
function editor() {
  return `<div class="editor-page"><div class="editor-header"><div><button class="back-link" data-view="workflows">${icon("back")}Workflows</button><h1>Daily Orders Report <button class="icon-btn" data-dialog="workflow-settings" aria-label="Workflow settings">${icon("down")}</button></h1><p>Collect daily orders, update the report, and prepare a summary.</p></div><div class="editor-actions"><span class="saved-label">${icon("check")}All changes saved</span>${button("Test workflow", "play", true, 'data-dialog="test"')}</div></div><div class="editor-tabs"><div class="filter-tabs"><button aria-pressed="true" data-editor-tab="Canvas">${icon("workflow")}Canvas</button><button data-editor-tab="Steps">Steps <span>3</span></button><button data-editor-tab="Runs">Runs</button><button data-editor-tab="Settings">Settings</button></div><span class="editor-sample">Concept workflow · sample steps</span></div><div class="editor-body"><section class="canvas" aria-label="Workflow canvas"><div class="canvas-status"><span class="status-dot warning"></span>One step left to teach <span>·</span> Review before running</div><div class="node-stage"><svg class="node-lines" viewBox="0 0 900 500" preserveAspectRatio="none" aria-hidden="true"><path d="M215 208C300 208 260 288 345 288M552 288C640 288 590 208 677 208"/></svg>${steps.map((s, i) => `<button class="flow-node flow-node-${i} ${selectedStep === i ? "selected" : ""}" data-step="${i}" aria-pressed="${selectedStep === i}"><span class="node-port port-left"></span><span class="node-top">${app(s.app)}<small>${String(i + 1).padStart(2, "0")}</small><span>${icon("more")}</span></span><span class="node-title">${s.title}</span><span class="node-subtitle">${s.sub}</span><span class="node-rule"></span>${badge(s.state)}<span class="node-port port-right"></span></button>`).join("")}<button class="add-step" data-dialog="add-step">${icon("plus")}Add a step</button></div><div class="canvas-bottom"><div class="zoom-controls"><button class="icon-btn" data-action="zoom-out" aria-label="Zoom out">−</button><span id="zoom-label">100%</span><button class="icon-btn" data-action="zoom-in" aria-label="Zoom in">+</button><i></i><button class="icon-btn" data-action="fit" aria-label="Fit canvas">${icon("grid")}</button></div><div class="minimap" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="run-log"><button data-dialog="run-log">${icon("activity")}Run log ${icon("down")}</button><span>No test runs yet</span></div></section><aside class="step-inspector" id="step-inspector" aria-label="Step inspector">${inspector()}</aside></div></div>`;
}

function recording() {
  return `<div class="recording-page"><div class="recording-heading"><div><button class="back-link" data-view="editor">${icon("back")}Daily Orders Report</button><h1>Show Ghost your routine.</h1><p class="page-description">Do it once, just as you normally would.</p></div><span class="preview-pill">${icon("record")}Recording preview</span></div><div class="recorder-layout"><aside class="record-instructions"><span class="step-label">Step 3 · Slack</span><h2>Draft team summary</h2><p>Prepare a daily orders summary in #reports.</p><ol class="instruction-list"><li>Open the #reports channel</li><li>Prepare the daily summary</li><li>Keep the message as a draft</li></ol><div class="recorder-tip">${icon("lock")}<p>Stay in control. Review captured actions before saving.</p></div></aside><section class="browser-preview"><div class="browser-toolbar">${icon("back")}${icon("arrow")}<div>${icon("lock")}app.slack.com / workspace</div>${icon("more")}</div><div class="browser-placeholder"><div class="browser-illustration">${icon("mouse")}</div><h2>Your demonstration starts here.</h2><p>Ghost captures the steps you show in its teaching browser.</p>${button("Start demonstration", "record", true, 'data-action="demo-record"')}<small>Design preview · browser capture is simulated</small></div></section><aside class="captured-actions"><h2>Captured actions <span id="capture-count">0</span></h2><div id="capture-list"><div class="capture-empty">${icon("activity")}<p>Your actions will appear here as you work.</p></div></div></aside></div><div class="recording-footer"><span>${icon("lock")}No recording or external action is performed in this preview.</span>${button("Return to workflow", "back", false, 'data-view="editor"')}</div></div>`;
}

function system() {
  const swatches = [
    ["Canvas", "F5F7FA"],
    ["Surface", "FFFFFF"],
    ["Ink", "222935"],
    ["Secondary", "697382"],
    ["Action", "1670B9"],
    ["Sky wash", "EAF4FD"],
    ["Lilac", "EEE9FA"],
    ["Mint", "EAF3EE"],
    ["Peach", "FFF0E8"],
  ];
  return `<div class="system-page page-content"><div class="page-heading"><div><p class="overline">Ghost / Air · Design system v0.1</p><h1>Soft on the eyes.<br>Clear on the details.</h1><p class="page-description">One shared language for every part of your work.</p></div><div class="system-status"><span class="status-dot warning"></span>Proposed direction<small>Ready for visual review</small></div></div><div class="system-principles"><span>${icon("layers")}Quiet surfaces</span><span>${icon("mouse")}Obvious next actions</span><span>${icon("grid")}Room to breathe</span><span>${icon("lock")}Always in control</span></div><section class="system-section"><div class="system-section-title"><span>01</span><h2>A calm, purposeful palette</h2><p>Cool neutrals carry the interface. Blue guides action.</p></div><div class="swatches">${swatches.map(([n, v]) => `<button class="swatch" style="--swatch:#${v}" data-color="#${v}" aria-label="Copy ${n} color #${v}"><i></i><strong>${n}</strong><small>#${v}</small></button>`).join("")}</div><div class="semantic-palette"><span>${badge("Ready")}Success · #247352</span><span>${badge("Needs teaching")}Attention · #946318</span><span><span class="state error"><i class="status-dot"></i>Couldn’t complete</span>Error · #B64646</span></div></section><div class="system-two-col"><section class="system-section type-section"><div class="system-section-title"><span>02</span><h2>One typeface. Clear hierarchy.</h2></div><div class="font-display">Aa<span>Geist Variable</span></div><div class="type-sample"><span style="font-size:var(--text-display);letter-spacing:-.04em;line-height:1.12">A little lighter.</span><small>Display · 48 / 54 · Regular</small></div><div class="type-row"><h2>Everything in its place.</h2><small>Section · 20 / 28 · Medium</small></div><div class="type-row"><p>Readable text, at a comfortable size.</p><small>Body · 14 / 21 · Regular</small></div><div class="type-row"><span class="caption">A useful detail, quietly there.</span><small>Caption · 12 / 18 · Regular</small></div></section><section class="system-section"><div class="system-section-title"><span>03</span><h2>Space, shape & elevation</h2></div><div class="spacing-scale">${[4, 8, 12, 16, 24, 32, 48, 64].map((n) => `<div><i style="height:${n}px"></i><span>${n}</span></div>`).join("")}</div><p class="system-note">A 4px base. 40px desktop page padding. 24px section spacing.</p><div class="radius-scale">${[8, 12, 16, 24].map((n) => `<div style="border-radius:${n}px">${n}<small>px</small></div>`).join("")}</div><div class="shadow-scale"><div class="shadow-one">Control<small>Subtle</small></div><div class="shadow-two">Panel<small>Ambient</small></div><div class="shadow-three">Popover<small>Floating</small></div></div></section></div><section class="system-section component-section"><div class="system-section-title"><span>04</span><h2>Small components. One family.</h2><p>40px controls · 44px navigation · visible keyboard focus</p></div><div class="component-grid"><div class="component-example"><span class="component-label">Actions</span>${button("Create workflow", "plus", true, 'data-action="sample-action"')}${button("View details", "arrow", false, 'data-action="sample-action"')}<button class="btn" disabled>Saving…</button></div><div class="component-example"><span class="component-label">Input & focus</span><label class="system-input-label" for="sample-name">Workflow name</label><input class="system-input" id="sample-name" value="Daily Orders Report"><small>Choose a name you’ll recognize.</small></div><div class="component-example"><span class="component-label">Meaningful states</span>${badge("Ready")}${badge("Needs teaching")}${badge("Draft")}<span class="state error"><i class="status-dot"></i>Needs review</span></div></div></section><section class="system-section"><div class="system-section-title"><span>05</span><h2>Designed for the in-between, too.</h2><p>Every data surface gets loading, empty, and recovery states.</p></div><div class="state-examples"><div><span class="component-label">Loading</span><div class="skeleton-line long"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div><p>Keep the final layout stable.</p></div><div><span class="component-label">Empty</span>${icon("workflow")}<strong>Your first routine starts here.</strong><p>Describe a task you’d love to hand over.</p><button class="text-btn" data-action="new">Create a workflow ${icon("arrow")}</button></div><div><span class="component-label">Error</span><span class="state error">Couldn’t load your workflows</span><p>Your work is saved. Give it another try.</p><button class="text-btn" data-action="sample-retry">Try again ${icon("arrow")}</button></div></div></section><footer class="system-footer">Motion: 120 / 180 / 240ms · No idle animation · Reduced motion respected<span>Designed for desktop. Adapted at 1024px and 768px.</span></footer></div>`;
}

function drawConnections() {
  const stage = document.querySelector(".node-stage");
  if (!stage) return;
  const nodes = [...stage.querySelectorAll(".flow-node")];
  const svg = stage.querySelector(".node-lines");
  svg.setAttribute("viewBox", `0 0 ${stage.clientWidth} ${stage.clientHeight}`);
  svg.innerHTML = nodes
    .slice(0, -1)
    .map((node, i) => {
      const next = nodes[i + 1];
      const x = node.offsetLeft + node.offsetWidth,
        y = node.offsetTop + node.offsetHeight / 2;
      const endX = next.offsetLeft,
        endY = next.offsetTop + next.offsetHeight / 2;
      const bend = (endX - x) / 2;
      return `<path d="M${x} ${y}C${x + bend} ${y} ${endX - bend} ${endY} ${endX} ${endY}"/>`;
    })
    .join("");
}
window.addEventListener("resize", () => requestAnimationFrame(drawConnections));
function hydrateIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
function render(name, setHash = true) {
  const renderers = { home, workflows: library, editor, recording, system };
  activeView = renderers[name] ? name : "home";
  document.querySelectorAll(".review-nav [data-view]").forEach((b) => {
    if (b.dataset.view === activeView) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-nav]").forEach((b) => {
    if (
      b.dataset.nav === activeView ||
      (activeView === "editor" && b.dataset.nav === "workflows")
    )
      b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.querySelector("#breadcrumb").textContent = {
    home: "Home",
    workflows: "Workflows",
    editor: "Workflows / Daily Orders Report",
    recording: "Teaching browser",
    system: "Design system",
  }[activeView];
  view.innerHTML = renderers[activeView]();
  if (activeView === "editor") requestAnimationFrame(drawConnections);
  view.className = `view-${activeView}`;
  view.scrollTop = 0;
  if (setHash) history.replaceState(null, "", `#${activeView}`);
}
let toastTimer;
function toast(message) {
  const el = document.querySelector("#toast");
  el.innerHTML = `${icon("check")}<span>${message}</span>`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}
function showDialog(title, html) {
  document.querySelector("#dialog-kicker").textContent = title;
  document.querySelector("#dialog-content").innerHTML = html;
  document.querySelector("#preview-dialog").showModal();
}
function dialog(name) {
  const descriptions = {
    workspace: [
      "Your workspace",
      "A personal space for your workflows.",
      "This is a visual prototype with sample workflows. The menu demonstrates the proposed workspace and account presentation.",
    ],
    activity: [
      "Recent activity",
      "A little context goes a long way.",
      "Screenpipe activity is simulated in this design preview. This panel demonstrates how recorded activity could be presented.",
    ],
    integrations: [
      "Your connections",
      "Bring your tools together.",
      "Screenpipe is not connected in this preview. No app account or recording is accessed.",
    ],
    settings: [
      "Settings",
      "Make yourself at home.",
      "Proposed defaults: light appearance, reduced motion support, and a spacious desktop layout.",
    ],
    help: [
      "A little help",
      "Start with something you do on repeat.",
      "Describe the routine, review the generated steps, then teach Ghost any browser actions it needs.",
    ],
    "step-review": [
      "Review this step",
      "A recording you can inspect.",
      "Captured actions, inputs, and observed results will appear here in the app. This preview uses sample steps.",
    ],
    "run-log": [
      "Run log",
      "Your workflow’s story, step by step.",
      "No test runs have been performed. The app will show actual outcomes, errors, and retry actions here.",
    ],
    "workflow-settings": [
      "Workflow settings",
      "Daily Orders Report",
      "Rename, export, and schedule controls will use the same form and dialog system.",
    ],
    test: [
      "Review before testing",
      "One step still needs teaching.",
      "Teach “Draft team summary” before testing browser actions. This design preview does not run workflows.",
    ],
  };
  if (name === "templates") {
    showDialog(
      "Workflow templates",
      `<h2>A head start, for everyday work.</h2><p>Choose a sample to explore its workflow.</p><div class="template-list">${workflows
        .slice(0, 3)
        .map(
          (w) =>
            `<button data-view="editor">${apps(w.apps)}<span><strong>${w.name}</strong><small>${w.steps} steps · Preview template</small></span>${icon("arrow")}</button>`,
        )
        .join("")}</div>`,
    );
    return;
  }
  if (name === "add-step") {
    showDialog(
      "Add a step",
      `<h2>What happens next?</h2><p>Every step has a clear job.</p><div class="template-list"><button data-view="recording">${icon("mouse")}<span><strong>Browser action</strong><small>Show Ghost how to work in an app.</small></span>${icon("arrow")}</button><button data-action="add-processing">${icon("file")}<span><strong>Data processing</strong><small>Transform files and prepare outputs.</small></span>${icon("arrow")}</button></div>`,
    );
    return;
  }
  const [title, heading, body] = descriptions[name] || descriptions.settings;
  showDialog(
    title,
    `<span class="dialog-symbol">${icon(name === "integrations" ? "plug" : name === "test" ? "record" : "ghost")}</span><h2>${heading}</h2><p>${body}</p>${name === "integrations" ? `<div class="dialog-apps">${["Screenpipe", "Chrome", "Excel", "Slack", "Notion", "Gmail"].map(app).join("")}</div><div class="connection-detail"><span class="status-dot muted"></span>Preview mode · not connected</div>` : ""}${name === "activity" ? `<div class="dialog-activity">${["Chrome", "Excel", "Notion"].map((a, i) => `<div>${app(a)}<span>${["Opened orders dashboard", "Exported orders.csv", "Updated a project page"][i]}</span><small>Sample</small></div>`).join("")}</div>` : ""}${name === "test" ? button("Teach this step", "record", true, 'data-view="recording"') : ""}`,
  );
}

document.addEventListener("click", async (e) => {
  const target = e.target.closest("button,[data-view]");
  if (!target) return;
  if (target.dataset.view) {
    document.querySelector("#preview-dialog").close();
    render(target.dataset.view);
    return;
  }
  if (target.dataset.dialog) {
    dialog(target.dataset.dialog);
    return;
  }
  if (target.dataset.filter) {
    activeFilter = target.dataset.filter;
    view.innerHTML = library();
    return;
  }
  if (target.dataset.step !== undefined) {
    selectedStep = Number(target.dataset.step);
    view.innerHTML = editor();
    requestAnimationFrame(drawConnections);
    return;
  }
  if (target.dataset.color) {
    try {
      await navigator.clipboard.writeText(target.dataset.color);
      toast(`${target.dataset.color} copied`);
    } catch {
      toast(`Color: ${target.dataset.color}`);
    }
    return;
  }
  if (target.dataset.editorTab) {
    if (target.dataset.editorTab === "Canvas") return;
    if (target.dataset.editorTab === "Steps") {
      showDialog(
        "Workflow steps",
        `<h2>One routine. Three clear steps.</h2><div class="template-list">${steps.map((s, i) => `<button data-select-step="${i}">${app(s.app)}<span><strong>${s.title}</strong><small>${s.sub}</small></span>${badge(s.state)}</button>`).join("")}</div>`,
      );
    } else
      dialog(
        target.dataset.editorTab === "Runs" ? "run-log" : "workflow-settings",
      );
    return;
  }
  if (target.dataset.selectStep !== undefined) {
    selectedStep = Number(target.dataset.selectStep);
    document.querySelector("#preview-dialog").close();
    render("editor");
    return;
  }
  const action = target.dataset.action;
  if (action === "describe") {
    document.querySelector("#workflow-prompt").focus();
    return;
  }
  if (action === "new") {
    render("home");
    document.querySelector("#workflow-prompt").focus();
    return;
  }
  if (action === "save") {
    steps[selectedStep].desc =
      document.querySelector("#step-description").value;
    toast("Step saved for this preview session");
    return;
  }
  if (action === "sample-action") {
    toast("Example action · design preview only");
    return;
  }
  if (action === "sample-retry") {
    toast("Recovery state previewed");
    return;
  }
  if (action === "add-processing") {
    document.querySelector("#preview-dialog").close();
    selectedStep = 1;
    render("editor");
    toast("Showing the data processing step");
    return;
  }
  if (action === "clear-search") {
    libraryQuery = "";
    activeFilter = "All workflows";
    render("workflows");
    return;
  }
  if (action === "demo-record") {
    target.disabled = true;
    target.innerHTML = `${icon("check")}Demonstration previewed`;
    document.querySelector("#capture-count").textContent = "3";
    document.querySelector("#capture-list").innerHTML = [
      "Opened #reports",
      "Prepared the summary",
      "Kept message as a draft",
    ]
      .map(
        (x, i) =>
          `<div class="capture-action"><span>${i + 1}</span><div>${x}<small>Simulated action</small></div>${icon("check")}</div>`,
      )
      .join("");
    toast("Sample actions shown · no recording performed");
    return;
  }
  if (action?.startsWith("zoom-") || action === "fit") {
    const label = document.querySelector("#zoom-label");
    let zoom = Number(label.textContent.replace("%", ""));
    zoom =
      action === "fit"
        ? 100
        : Math.max(60, Math.min(120, zoom + (action === "zoom-in" ? 10 : -10)));
    label.textContent = `${zoom}%`;
    document.querySelector(".node-stage").style.transform =
      `scale(${zoom / 100})`;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "library-search") {
    libraryQuery = e.target.value;
    document.querySelector("#workflow-rows").innerHTML = workflowRows();
    document.querySelector("#workflow-count").textContent =
      `${document.querySelectorAll("#workflow-rows .table-workflow").length} sample workflows`;
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "create-form") {
    e.preventDefault();
    const value = document.querySelector("#workflow-prompt").value.trim();
    if (!value) {
      document.querySelector("#workflow-prompt").focus();
      return;
    }
    showDialog(
      "Workflow preview",
      `<span class="dialog-symbol">${icon("sparkle")}</span><h2>Your routine, with a little structure.</h2><p id="prompt-echo"></p><div class="dialog-callout">This concept opens a sample workflow to demonstrate the design. It doesn’t generate or save a real workflow.</div>${button("Explore sample workflow", "arrow", true, 'data-view="editor"')}`,
    );
    document.querySelector("#prompt-echo").textContent = value;
  }
});
document
  .querySelector("#close-dialog")
  .addEventListener("click", () =>
    document.querySelector("#preview-dialog").close(),
  );
document.querySelector("#preview-dialog").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    const r = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.currentTarget.close();
  }
});
function search() {
  if (activeView === "workflows") {
    document.querySelector("#library-search").focus();
    return;
  }
  showDialog(
    "Search your workspace",
    `<h2>Find your next step.</h2><label class="command-search">${icon("search")}<input id="command-input" aria-label="Search sample workflows" placeholder="Search workflows or apps…" autofocus></label><div id="command-results" class="template-list">${workflows.map((w) => `<button data-view="editor">${apps(w.apps)}<span><strong>${w.name}</strong><small>${w.apps.join(" · ")}</small></span>${icon("arrow")}</button>`).join("")}</div>`,
  );
  document.querySelector("#command-input").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document
      .querySelectorAll("#command-results button")
      .forEach((b) => (b.hidden = !b.textContent.toLowerCase().includes(q)));
  });
}
document.querySelector("#search-trigger").addEventListener("click", search);
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    if (document.querySelector("#preview-dialog").open)
      document.querySelector("#preview-dialog").close();
    search();
  }
});
window.addEventListener("hashchange", () =>
  render(location.hash.slice(1), false),
);
hydrateIcons();
render(location.hash.slice(1) || "home");
