import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Braces,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  FileText,
  GitBranch,
  Globe2,
  House,
  Layers3,
  LayoutGrid,
  Link2,
  List,
  Maximize,
  Monitor,
  Moon,
  MoreHorizontal,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  Video,
  Workflow as WorkflowIcon,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from "lucide-react";
import "./tokens.css";
import "./styles.css";

type Page =
  | "home"
  | "workflows"
  | "editor"
  | "settings"
  | "system"
  | "record"
  | "welcome";
type Theme = "light" | "dark" | "system";
type NodeData = {
  name: string;
  detail: string;
  kind: "browser" | "action" | "trigger";
  state: "Ready" | "Needs teaching";
};
type WorkflowData = {
  id: number;
  name: string;
  description: string;
  status: "Ready" | "Draft" | "Needs teaching";
  updated: string;
  apps: string[];
  nodes: NodeData[];
  scheduled?: boolean;
};
type DialogData = {
  kind:
    | "search"
    | "create"
    | "schedule"
    | "delete"
    | "run"
    | "node"
    | "connection"
    | "share"
    | "help"
    | "source"
    | "import";
  workflow?: WorkflowData;
};
const weeklyNodes: NodeData[] = [
  {
    name: "Collect weekly updates",
    detail: "Read the latest team updates",
    kind: "browser",
    state: "Ready",
  },
  {
    name: "Prepare a summary",
    detail: "Turn the updates into a short report",
    kind: "action",
    state: "Ready",
  },
  {
    name: "Post to the team channel",
    detail: "Share the report in Slack",
    kind: "browser",
    state: "Needs teaching",
  },
];
const initialWorkflows: WorkflowData[] = [
  {
    id: 1,
    name: "Weekly team update",
    description:
      "Collect project updates, prepare a short summary, and share it with the team.",
    status: "Needs teaching",
    updated: "Edited 12 min ago",
    apps: ["Notion", "Slack"],
    nodes: weeklyNodes,
  },
  {
    id: 2,
    name: "Customer follow-ups",
    description: "Review open conversations and draft the next follow-up.",
    status: "Ready",
    updated: "Edited 2 hours ago",
    apps: ["Chrome", "Gmail"],
    nodes: [weeklyNodes[0], weeklyNodes[1]],
    scheduled: true,
  },
  {
    id: 3,
    name: "Organize new invoices",
    description: "Collect new invoices and file them in the right folder.",
    status: "Draft",
    updated: "Edited yesterday",
    apps: ["Chrome", "Drive"],
    nodes: [weeklyNodes[0], { ...weeklyNodes[2], name: "File the invoice" }],
  },
  {
    id: 4,
    name: "Daily project notes",
    description: "Bring the day’s project notes into one readable recap.",
    status: "Ready",
    updated: "Edited yesterday",
    apps: ["Notion"],
    nodes: [weeklyNodes[0], weeklyNodes[1]],
  },
];
const templateWorkflows = [
  {
    ...initialWorkflows[0],
    id: 101,
    name: "Summarize team updates",
    status: "Draft" as const,
    updated: "Start with 3 steps",
  },
  {
    ...initialWorkflows[1],
    id: 102,
    name: "Follow up with a customer",
    status: "Draft" as const,
    updated: "Start with 2 steps",
    scheduled: false,
  },
  {
    ...initialWorkflows[2],
    id: 103,
    name: "File an invoice",
    status: "Draft" as const,
    updated: "Start with 2 steps",
  },
];
const nodeIcons = { browser: Globe2, action: Braces, trigger: CalendarClock };
const pageFromHash = (): Page => {
  const value = location.hash.slice(1).split("?")[0];
  return [
    "home",
    "workflows",
    "editor",
    "settings",
    "system",
    "record",
    "welcome",
  ].includes(value)
    ? (value as Page)
    : "home";
};
function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(`ghost-blue-proposal.${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, value: string) {
  try {
    localStorage.setItem(`ghost-blue-proposal.${key}`, value);
  } catch {
    /* The preview also works without storage. */
  }
}

function GhostMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 45) / 38}
      viewBox="0 0 38 45"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.1 19C3.7 8.1 10.1 1 19 1S34.3 8.1 34.9 19L37 40.3c.3 3.1-2.2 4.4-4.6 2.8l-5.1-3.3-5.4 3.3a5.7 5.7 0 0 1-5.8 0l-5.4-3.3-5.1 3.3c-2.4 1.6-4.9.3-4.6-2.8L3.1 19Z"
        fill="currentColor"
      />
      <ellipse
        cx="13.2"
        cy="19"
        rx="2.7"
        ry="3.2"
        fill="var(--surface-canvas)"
      />
      <ellipse
        cx="24.8"
        cy="19"
        rx="2.7"
        ry="3.2"
        fill="var(--surface-canvas)"
      />
    </svg>
  );
}
function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  className = "",
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button tip ${active ? "selected" : ""} ${className}`}
      aria-label={label}
      data-tip={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );
}
function Status({ value }: { value: string }) {
  const Icon =
    value === "Ready" ? CheckCheck : value === "Draft" ? FileText : Circle;
  return (
    <span
      className={`status status-${value.toLowerCase().replaceAll(" ", "-")}`}
    >
      <Icon size={13} aria-hidden="true" />
      {value}
    </span>
  );
}
function ThemeControl({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (v: Theme) => void;
}) {
  return (
    <div className="theme-control" role="group" aria-label="Preview appearance">
      {(
        [
          [Sun, "light"],
          [Moon, "dark"],
          [Monitor, "system"],
        ] as const
      ).map(([Icon, value]) => (
        <button
          type="button"
          key={value}
          onClick={() => setTheme(value)}
          aria-label={`${value[0].toUpperCase() + value.slice(1)} theme`}
          aria-pressed={theme === value}
          className="tip"
          data-tip={`${value[0].toUpperCase() + value.slice(1)} theme`}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const element = ref.current!;
    element.showModal();
    return () => {
      element.close();
      requestAnimationFrame(() => {
        if (returnFocus.current?.isConnected)
          returnFocus.current.focus({ preventScroll: true });
        else
          document
            .querySelector<HTMLElement>("#main-content")
            ?.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-header">
        <h2 id="dialog-title">{title}</h2>
        <IconButton icon={X} label="Close dialog" onClick={onClose} />
      </div>
      {children}
    </dialog>
  );
}

function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [theme, setTheme] = useState<Theme>(() => {
    const value = stored("theme", "light");
    return ["light", "dark", "system"].includes(value)
      ? (value as Theme)
      : "light";
  });
  const [collapsed, setCollapsed] = useState(
    () => stored("sidebar", "open") === "closed",
  );
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [activeId, setActiveId] = useState(1);
  const [dialog, setDialog] = useState<DialogData | null>(null);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("All workflows");
  const [query, setQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [settingsSection, setSettingsSection] = useState("Appearance");
  const [editorTab, setEditorTab] = useState("Canvas");
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [inspector, setInspector] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [runResult, setRunResult] = useState(false);
  const [search, setSearch] = useState("");
  const [searchCategory, setSearchCategory] = useState("All");
  const [zoom, setZoom] = useState(100);
  const [listView, setListView] = useState(false);
  const main = useRef<HTMLElement>(null);
  const active =
    workflows.find((w) => w.id === activeId) ??
    workflows[0] ??
    initialWorkflows[0];
  const notify = (message: string) => setNotice(message);
  const navigate = (next: Page) => {
    location.hash = next;
    setPage(next);
    setAddMenu(false);
  };
  const openWorkflow = (workflow: WorkflowData) => {
    setActiveId(workflow.id);
    setSelectedNode(null);
    setInspector(false);
    setEditorTab("Canvas");
    setDescriptionOpen(false);
    navigate("editor");
  };
  const updateActive = (change: Partial<WorkflowData>) =>
    setWorkflows((all) =>
      all.map((w) => (w.id === active.id ? { ...w, ...change } : w)),
    );
  const createDraft = (name: string, nodes = weeklyNodes) => {
    const draft: WorkflowData = {
      id: Date.now(),
      name,
      description:
        "Your workflow draft. Review the steps and teach Ghost the browser actions.",
      status: "Draft",
      updated: "Edited just now",
      apps: ["Chrome"],
      nodes,
    };
    setWorkflows((all) => [draft, ...all]);
    setDialog(null);
    openWorkflow(draft);
    notify("Draft created in this preview. Your app is unchanged.");
  };

  useEffect(() => {
    const changed = () => setPage(pageFromHash());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const match = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (match.matches ? "dark" : "light") : theme;
    };
    apply();
    persist("theme", theme);
    match.addEventListener("change", apply);
    return () => match.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    persist("sidebar", collapsed ? "closed" : "open");
  }, [collapsed]);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    document.title = `Ghost / Blue — ${page === "system" ? "Design system" : page[0].toUpperCase() + page.slice(1)}`;
  }, [page]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddMenu(false);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch("");
        setDialog({ kind: "search" });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  function workflowCard(workflow: WorkflowData, template = false) {
    return (
      <article key={workflow.id} className="workflow-card">
        <button
          className="card-open"
          onClick={() =>
            template
              ? createDraft(workflow.name, workflow.nodes)
              : openWorkflow(workflow)
          }
          aria-label={
            template
              ? `Use template: ${workflow.name}`
              : `Open workflow: ${workflow.name}`
          }
        >
          <span className="sr-only">{workflow.name}</span>
        </button>
        <div className="card-top">
          <span className="node-count">
            <WorkflowIcon size={15} aria-hidden="true" />
            {workflow.nodes.length} nodes
          </span>
          {template ? (
            <span className="caption">Template</span>
          ) : (
            <Status value={workflow.status} />
          )}
        </div>
        <div className="card-copy">
          <h2>{workflow.name}</h2>
          <p>{workflow.description}</p>
        </div>
        <div className="app-list">
          {workflow.apps.map((app, i) => (
            <span key={app} className="app-name">
              <span className="app-symbol">
                {i === 0 ? <Globe2 size={12} /> : <Layers3 size={12} />}
              </span>
              {app}
            </span>
          ))}
        </div>
        <footer className="card-footer">
          <span>
            {workflow.scheduled ? (
              <>
                <CalendarClock size={13} />
                Weekdays, 9:00
              </>
            ) : (
              workflow.updated
            )}
          </span>
          {template ? (
            <span className="card-hint">
              Use template <ArrowUpRight size={14} />
            </span>
          ) : (
            <div className="card-actions">
              <IconButton
                icon={Play}
                label={`Run ${workflow.name}`}
                onClick={() => setDialog({ kind: "run", workflow })}
              />
              <IconButton
                icon={CalendarClock}
                label={`Schedule ${workflow.name}`}
                onClick={() => setDialog({ kind: "schedule", workflow })}
              />
              <IconButton
                icon={Trash2}
                label={`Delete ${workflow.name}`}
                onClick={() => setDialog({ kind: "delete", workflow })}
              />
            </div>
          )}
        </footer>
      </article>
    );
  }

  const visible = (
    filter === "Templates" ? templateWorkflows : workflows
  ).filter(
    (w) =>
      (filter !== "Drafts" || w.status === "Draft") &&
      (filter !== "Scheduled" || w.scheduled) &&
      `${w.name} ${w.description} ${w.apps.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const SidebarLink = ({
    to,
    icon: Icon,
    label,
  }: {
    to: Page;
    icon: LucideIcon;
    label: string;
  }) => (
    <a
      href={`#${to}`}
      aria-label={label}
      data-tip={label}
      className={`nav-link tip ${page === to || (to === "workflows" && ["editor", "record"].includes(page)) ? "active" : ""}`}
      aria-current={
        page === to ||
        (to === "workflows" && ["editor", "record"].includes(page))
          ? "page"
          : undefined
      }
    >
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
      <span>{label}</span>
    </a>
  );

  function renderHome() {
    return (
      <div className="home-page page-scroll">
        <header className="quiet-page-header">
          <span>Home</span>
          <button
            className="text-button"
            onClick={() => setDialog({ kind: "help" })}
          >
            <CircleHelp size={16} />
            How Ghost works
          </button>
        </header>
        <div className="home-content">
          <section className="home-hero">
            <div className="hero-mark">
              <WorkflowIcon size={27} strokeWidth={1.5} />
            </div>
            <h1>
              Your work.
              <br />
              <span>A little less busy.</span>
            </h1>
            <p>Turn a routine into a workflow. Start with what you do.</p>
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                if (prompt.trim())
                  createDraft(
                    prompt.trim().length > 60
                      ? prompt.trim().slice(0, 57) + "…"
                      : prompt.trim(),
                  );
                else document.getElementById("home-prompt")?.focus();
              }}
            >
              <label className="sr-only" htmlFor="home-prompt">
                Describe a routine to automate
              </label>
              <textarea
                id="home-prompt"
                aria-label="Describe a routine to automate"
                name="routine"
                rows={2}
                placeholder="What would you like to automate?"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                    event.currentTarget.form?.requestSubmit();
                }}
              />
              <div className="composer-footer">
                <button
                  type="button"
                  className="source-button"
                  onClick={() => setDialog({ kind: "source" })}
                >
                  <Database size={15} />
                  <span>Screenpipe history</span>
                  <ChevronDown size={13} />
                </button>
                <button type="submit" className="button primary">
                  Find my workflow <ArrowRight size={16} />
                </button>
              </div>
            </form>
            <div className="suggestions">
              <button
                onClick={() => setPrompt("Summarize my weekly team updates")}
              >
                <FileText size={15} />
                Team updates
              </button>
              <button
                onClick={() => setPrompt("Find how I follow up with customers")}
              >
                <Bell size={15} />
                Customer follow-ups
              </button>
              <button onClick={() => navigate("record")}>
                <Video size={15} />
                Record a routine
              </button>
            </div>
            <p className="home-help">Review the steps before anything runs.</p>
          </section>
          <section className="recent-section" aria-labelledby="recent-heading">
            <div className="section-heading">
              <h2 id="recent-heading">Pick up where you left off</h2>
              <a className="text-button" href="#workflows">
                All workflows <ArrowRight size={15} />
              </a>
            </div>
            <div className="recent-grid">
              {workflows.slice(0, 2).map((w) => workflowCard(w))}
            </div>
            {workflows.length === 0 && (
              <div className="empty-state">
                <WorkflowIcon size={24} />
                <h3>Your first workflow starts here</h3>
                <p>Describe a routine above to create a draft.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  function renderWorkflows() {
    return (
      <div className="page-scroll">
        <div className="library-page">
          <div className="page-heading">
            <div>
              <h1>Workflows</h1>
              <p>Your routines, ready when you need them.</p>
            </div>
            <button
              className="button primary"
              onClick={() => setDialog({ kind: "create" })}
            >
              <Plus size={17} />
              New workflow
            </button>
          </div>
          <div
            className="library-tabs"
            role="group"
            aria-label="Filter workflows"
          >
            {["All workflows", "Drafts", "Scheduled", "Templates"].map(
              (item) => (
                <button
                  key={item}
                  aria-pressed={filter === item}
                  className={filter === item ? "active" : ""}
                  onClick={() => {
                    setFilter(item);
                    setQuery("");
                  }}
                >
                  {item}
                  {item === "All workflows" && (
                    <span className="count">{workflows.length}</span>
                  )}
                </button>
              ),
            )}
          </div>
          <div className="filter-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                type="search"
                placeholder={
                  filter === "Templates"
                    ? "Search templates…"
                    : "Search workflows…"
                }
                aria-label="Search workflows"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="toolbar-right">
              <button
                className="text-button"
                onClick={() => setDialog({ kind: "import" })}
              >
                <ArrowDownToLine size={15} />
                Import
              </button>
              <span className="toolbar-divider" />
              <div
                className="view-toggle"
                role="group"
                aria-label="Workflow view"
              >
                <IconButton
                  icon={LayoutGrid}
                  label="Card view"
                  active={!listView}
                  onClick={() => setListView(false)}
                />
                <IconButton
                  icon={List}
                  label="List view"
                  active={listView}
                  onClick={() => setListView(true)}
                />
              </div>
            </div>
          </div>
          {filter === "Templates" && (
            <p className="inline-note">
              <Copy size={15} />
              Using a template creates your own draft. The original stays
              unchanged.
            </p>
          )}
          <div className={`workflow-grid ${listView ? "workflow-list" : ""}`}>
            {visible.map((w) => workflowCard(w, filter === "Templates"))}
          </div>
          {!visible.length && (
            <div className="empty-state">
              <Search size={25} />
              <h2>
                {query
                  ? "No matching workflows"
                  : `No ${filter === "Drafts" ? "drafts" : filter === "Scheduled" ? "scheduled workflows" : "workflows"} yet`}
              </h2>
              <p>
                {query
                  ? "Try a different name or clear your search."
                  : "Create a workflow and build it one step at a time."}
              </p>
              <button
                className="button secondary"
                onClick={() =>
                  query ? setQuery("") : setDialog({ kind: "create" })
                }
              >
                {query ? "Clear search" : "Create workflow"}
              </button>
            </div>
          )}
          <p className="library-footnote">
            Sample workflows for this design preview. Changes stay in this tab.
          </p>
        </div>
      </div>
    );
  }

  function renderEditor() {
    return (
      <div className="editor-page">
        <header className="editor-header">
          <div className="editor-title-row">
            <a
              href="#workflows"
              className="icon-button tip"
              data-tip="Back to workflows"
              aria-label="Back to workflows"
            >
              <ArrowLeft size={18} />
            </a>
            <div className="editor-title">
              <h1 title={active.name}>{active.name}</h1>
              <span className="autosave">
                <Check size={13} />
                Draft preview
              </span>
            </div>
            <div className="editor-actions">
              <button
                className="button secondary"
                onClick={() => setDialog({ kind: "share", workflow: active })}
              >
                <ArrowUpRight size={15} />
                <span>Share</span>
              </button>
              <button
                className="button primary"
                onClick={() => setDialog({ kind: "run", workflow: active })}
              >
                <Play size={15} />
                Run workflow
              </button>
              <details className="overflow-menu">
                <summary className="icon-button" aria-label="Workflow options">
                  <MoreHorizontal size={19} />
                </summary>
                <div className="menu">
                  <button
                    onClick={() =>
                      setDialog({ kind: "schedule", workflow: active })
                    }
                  >
                    <CalendarClock size={16} />
                    Schedule workflow
                  </button>
                  <button
                    onClick={() => {
                      setEditorTab("Settings");
                      setInspector(false);
                    }}
                  >
                    <Settings2 size={16} />
                    Workflow settings
                  </button>
                  <button
                    onClick={() =>
                      notify(
                        "JSON export is specified in the design guide; no app data is accessed.",
                      )
                    }
                  >
                    <ArrowDownToLine size={16} />
                    Export JSON
                  </button>
                </div>
              </details>
            </div>
          </div>
          <div className="editor-description">
            <Status value={active.status} />
            <button
              className="description-button"
              aria-expanded={descriptionOpen}
              onClick={() => setDescriptionOpen(!descriptionOpen)}
            >
              About this workflow{" "}
              <ChevronDown
                size={13}
                className={descriptionOpen ? "rotated" : ""}
              />
            </button>
            {descriptionOpen && <p>{active.description}</p>}
          </div>
          <div className="editor-tab-row">
            <nav aria-label="Workflow views">
              {["Canvas", "Steps", "Runs", "Activity", "Settings"].map(
                (tab) => (
                  <button
                    key={tab}
                    className={editorTab === tab ? "active" : ""}
                    aria-current={editorTab === tab ? "page" : undefined}
                    onClick={() => setEditorTab(tab)}
                  >
                    {tab}
                  </button>
                ),
              )}
            </nav>
            <span className="caption">
              {active.nodes.length} nodes
              <span className="dot-separator">·</span>
              {Math.max(0, active.nodes.length - 1)} connections
            </span>
          </div>
        </header>
        {editorTab === "Canvas" ? (
          <div className="canvas-layout">
            <div
              className="canvas-stage"
              onClick={() => {
                setAddMenu(false);
              }}
            >
              <div className="canvas-toolbar" aria-label="Canvas tools">
                <IconButton
                  icon={MousePointer2}
                  label="Select nodes"
                  active
                  onClick={() =>
                    notify("Click to select a node. Double-click to edit it.")
                  }
                />
                <div className="add-control">
                  <button
                    className="icon-button tip"
                    aria-label="Add to workflow"
                    data-tip={addMenu ? undefined : "Add node or connection"}
                    aria-expanded={addMenu}
                    aria-controls="add-menu"
                    onClick={(event) => {
                      event.stopPropagation();
                      setAddMenu(!addMenu);
                    }}
                  >
                    <Plus size={21} />
                  </button>
                  {addMenu && (
                    <div
                      id="add-menu"
                      className="menu add-menu"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setAddMenu(false);
                          setDialog({ kind: "node" });
                        }}
                      >
                        <Plus size={16} />
                        <span>
                          Add node<small>A new step in your workflow</small>
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setAddMenu(false);
                          setDialog({ kind: "connection" });
                        }}
                      >
                        <GitBranch size={16} />
                        <span>
                          Add connection<small>Link two existing steps</small>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
                <span className="tool-separator" />
                <IconButton
                  icon={Copy}
                  label={
                    selectedNode === null
                      ? "Select a node to duplicate it"
                      : "Duplicate selected node"
                  }
                  disabled={selectedNode === null}
                  onClick={() => {
                    if (selectedNode !== null)
                      updateActive({
                        nodes: [
                          ...active.nodes,
                          {
                            ...active.nodes[selectedNode],
                            name: `${active.nodes[selectedNode].name} copy`,
                          },
                        ],
                      });
                  }}
                />
                <IconButton
                  icon={Trash2}
                  label={
                    selectedNode === null
                      ? "Select a node to delete it"
                      : "Delete selected node"
                  }
                  disabled={selectedNode === null}
                  onClick={() => {
                    updateActive({
                      nodes: active.nodes.filter((_, i) => i !== selectedNode),
                    });
                    setSelectedNode(null);
                    setInspector(false);
                  }}
                />
              </div>
              <div className="canvas-note">
                <MousePointer2 size={14} />
                Click to select · Double-click to edit
              </div>
              <div className="graph-scroll">
                <div className="node-graph" style={{ zoom: zoom / 100 }}>
                  <div className="flow-start">
                    <span className="trigger-icon">
                      <Play size={13} />
                    </span>
                    Manual trigger
                  </div>
                  {active.nodes.map((node, i) => {
                    const Icon = nodeIcons[node.kind];
                    return (
                      <div className="node-chain" key={`${i}-${node.name}`}>
                        <div className="graph-connector">
                          <span />
                        </div>
                        <button
                          className={`graph-node ${selectedNode === i ? "node-selected" : ""}`}
                          aria-pressed={selectedNode === i}
                          onClick={() => setSelectedNode(i)}
                          onDoubleClick={() => {
                            setSelectedNode(i);
                            setInspector(true);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              setSelectedNode(i);
                              setInspector(true);
                            }
                          }}
                        >
                          <div className="node-topline">
                            <span className="node-type">
                              <Icon size={15} />
                              {node.kind === "browser"
                                ? "Browser"
                                : node.kind === "action"
                                  ? "Action"
                                  : "Trigger"}
                            </span>
                            <span className="node-index">0{i + 1}</span>
                          </div>
                          <strong>{node.name}</strong>
                          <p>{node.detail}</p>
                          <footer>
                            <Status value={node.state} />
                            <span className="node-open-hint">
                              <Settings2 size={13} />
                              Settings
                            </span>
                          </footer>
                        </button>
                      </div>
                    );
                  })}
                  <div className="graph-connector">
                    <span />
                  </div>
                  <button
                    className="add-step"
                    onClick={() => setDialog({ kind: "node" })}
                  >
                    <Plus size={16} />
                    Add step
                  </button>
                </div>
              </div>
              <div className="canvas-bottom">
                <div className="zoom-controls">
                  <IconButton
                    icon={ZoomOut}
                    label="Zoom out"
                    onClick={() => setZoom((v) => Math.max(60, v - 10))}
                  />
                  <span>{zoom}%</span>
                  <IconButton
                    icon={ZoomIn}
                    label="Zoom in"
                    onClick={() => setZoom((v) => Math.min(140, v + 10))}
                  />
                  <span className="toolbar-divider" />
                  <IconButton
                    icon={Maximize}
                    label="Reset canvas zoom"
                    onClick={() => setZoom(100)}
                  />
                </div>
                {selectedNode !== null && !inspector && (
                  <button
                    className="button secondary small"
                    onClick={() => setInspector(true)}
                  >
                    Edit selected node <ArrowUpRight size={14} />
                  </button>
                )}
                <button
                  className="button secondary small"
                  onClick={() => setLogsOpen(!logsOpen)}
                >
                  <List size={15} />
                  Run log
                  <ChevronDown
                    size={13}
                    className={logsOpen ? "rotated" : ""}
                  />
                </button>
              </div>
            </div>
            {inspector &&
              selectedNode !== null &&
              active.nodes[selectedNode] && (
                <aside className="node-inspector" aria-label="Node settings">
                  <header>
                    <h2>Node settings</h2>
                    <IconButton
                      icon={X}
                      label="Close node settings"
                      onClick={() => setInspector(false)}
                    />
                  </header>
                  <div className="inspector-body">
                    <span className="caption">
                      Step {selectedNode + 1} of {active.nodes.length}
                    </span>
                    <h3>{active.nodes[selectedNode].name}</h3>
                    <Status value={active.nodes[selectedNode].state} />
                    <label className="field">
                      Node name
                      <input
                        value={active.nodes[selectedNode].name}
                        onChange={(event) =>
                          updateActive({
                            nodes: active.nodes.map((node, i) =>
                              i === selectedNode
                                ? { ...node, name: event.target.value }
                                : node,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      What should happen?
                      <textarea
                        rows={3}
                        value={active.nodes[selectedNode].detail}
                        onChange={(event) =>
                          updateActive({
                            nodes: active.nodes.map((node, i) =>
                              i === selectedNode
                                ? { ...node, detail: event.target.value }
                                : node,
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="teaching-note">
                      <Video size={19} />
                      <h4>Show Ghost this step</h4>
                      <p>
                        Record the browser actions once. Review them before
                        saving.
                      </p>
                      <button
                        className="button primary"
                        onClick={() => navigate("record")}
                      >
                        <Video size={15} />
                        Teach this step
                      </button>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setDialog({ kind: "connection" })}
                    >
                      <Link2 size={15} />
                      Manage connections
                    </button>
                  </div>
                </aside>
              )}
          </div>
        ) : (
          <div className="editor-tab-content page-scroll">
            {editorTab === "Steps" ? (
              <>
                <h2>Workflow steps</h2>
                <p>Review the sequence, then open a step to edit it.</p>
                <div className="step-list">
                  {active.nodes.map((node, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setEditorTab("Canvas");
                        setSelectedNode(i);
                        setInspector(true);
                      }}
                    >
                      <span className="step-number">{i + 1}</span>
                      <span>
                        <strong>{node.name}</strong>
                        <small>{node.detail}</small>
                      </span>
                      <Status value={node.state} />
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </>
            ) : editorTab === "Runs" || editorTab === "Activity" ? (
              <>
                <div className="section-heading">
                  <h2>
                    {editorTab === "Runs" ? "Run history" : "Workflow activity"}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      setRunResult(false);
                      notify("Preview run logs and test results cleared.");
                    }}
                  >
                    Clear results
                  </button>
                </div>
                {runResult ? (
                  <div className="result-row">
                    <CheckCheck size={18} />
                    <div>
                      <strong>Preview run completed</strong>
                      <p>3 example steps · No browser actions were executed</p>
                    </div>
                    <span>Just now</span>
                  </div>
                ) : (
                  <div className="empty-state">
                    <Clock3 size={26} />
                    <h3>
                      No {editorTab === "Runs" ? "runs" : "activity"} in this
                      preview
                    </h3>
                    <p>Preview a run to see how its result appears here.</p>
                    <button
                      className="button secondary"
                      onClick={() =>
                        setDialog({ kind: "run", workflow: active })
                      }
                    >
                      Preview a run
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2>Workflow settings</h2>
                <p>
                  Keep the essentials here. Open advanced options only when
                  needed.
                </p>
                <label className="field">
                  Workflow name
                  <input
                    value={active.name}
                    onChange={(event) =>
                      updateActive({ name: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Description
                  <textarea
                    rows={3}
                    value={active.description}
                    onChange={(event) =>
                      updateActive({ description: event.target.value })
                    }
                  />
                </label>
                <div className="setting-row">
                  <div>
                    <h3>Schedule</h3>
                    <p>Choose when this workflow should run.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() =>
                      setDialog({ kind: "schedule", workflow: active })
                    }
                  >
                    Edit schedule
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Inputs and outputs</h3>
                    <p>Define the values this workflow uses and returns.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setDialog({ kind: "node" })}
                  >
                    Configure
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {logsOpen && editorTab === "Canvas" && (
          <div className="run-panel">
            <header>
              <h2>
                Run log <span>Preview</span>
              </h2>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    setRunResult(false);
                    notify("Run logs and test results cleared.");
                  }}
                >
                  Clear
                </button>
                <IconButton
                  icon={X}
                  label="Close run log"
                  onClick={() => setLogsOpen(false)}
                />
              </div>
            </header>
            <p>
              {runResult
                ? "Preview completed. No external actions were performed."
                : "No results yet. Run details will appear here."}
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="settings-page page-scroll">
        <div className="settings-content">
          <div className="page-heading">
            <div>
              <h1>Settings</h1>
              <p>A workspace that feels right for you.</p>
            </div>
          </div>
          <div
            className="settings-tabs"
            role="group"
            aria-label="Settings sections"
          >
            {["General", "Appearance", "Workspace"].map((section) => (
              <button
                className={settingsSection === section ? "active" : ""}
                aria-pressed={settingsSection === section}
                onClick={() => setSettingsSection(section)}
                key={section}
              >
                {section}
              </button>
            ))}
          </div>
          {settingsSection === "Appearance" ? (
            <>
              <section className="settings-section">
                <h2>Appearance</h2>
                <p>Choose how Ghost looks on this device.</p>
                <div
                  className="theme-options"
                  role="group"
                  aria-label="Choose appearance"
                >
                  {(["light", "dark", "system"] as const).map((option) => (
                    <button
                      className={`theme-option ${theme === option ? "active" : ""}`}
                      aria-pressed={theme === option}
                      onClick={() => setTheme(option)}
                      key={option}
                    >
                      <span className={`theme-thumbnail thumb-${option}`}>
                        <span className="thumb-sidebar">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="thumb-main">
                          <i />
                          <i />
                          <i />
                        </span>
                      </span>
                      <span className="theme-option-label">
                        {option === "light" ? (
                          <Sun size={16} />
                        ) : option === "dark" ? (
                          <Moon size={16} />
                        ) : (
                          <Monitor size={16} />
                        )}
                        {option[0].toUpperCase() + option.slice(1)}
                        <span
                          className={`radio-dot ${theme === option ? "checked" : ""}`}
                        />
                      </span>
                    </button>
                  ))}
                </div>
                <p className="setting-helper">
                  System follows your device’s appearance. Your choice saves
                  automatically.
                </p>
              </section>
              <section className="settings-section">
                <h2>Typography</h2>
                <div className="setting-row">
                  <div>
                    <h3>Comfortable by default</h3>
                    <p>Inter for titles, navigation, controls, and content.</p>
                  </div>
                  <span className="value-label">14–16 px</span>
                </div>
                <p className="setting-helper">
                  Monospace is reserved for code and technical values.
                </p>
              </section>
              <section className="settings-section">
                <h2>Navigation</h2>
                <div className="setting-row">
                  <div>
                    <h3>Compact sidebar</h3>
                    <p>Keep navigation available as an icon rail.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Compact sidebar"
                    aria-checked={collapsed}
                    className={`switch ${collapsed ? "on" : ""}`}
                    onClick={() => setCollapsed(!collapsed)}
                  >
                    <span />
                  </button>
                </div>
              </section>
            </>
          ) : settingsSection === "General" ? (
            <>
              <section className="settings-section">
                <h2>About Ghost</h2>
                <div className="setting-row">
                  <div>
                    <h3>Version</h3>
                    <p>Your work, understood.</p>
                  </div>
                  <span className="value-label">0.1.0</span>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Introduction</h3>
                    <p>A quick guide to your first workflow.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => navigate("welcome")}
                  >
                    View introduction <ArrowUpRight size={14} />
                  </button>
                </div>
              </section>
              <section className="settings-section">
                <h2>Help</h2>
                <div className="setting-row">
                  <div>
                    <h3>How Ghost works</h3>
                    <p>Discover, teach, review, then run.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setDialog({ kind: "help" })}
                  >
                    Open guide <BookOpen size={14} />
                  </button>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="settings-section">
                <h2>Workspace data</h2>
                <div className="setting-row">
                  <div>
                    <h3>Discovery source</h3>
                    <p>Find repeated routines in your local activity.</p>
                  </div>
                  <span className="value-label">
                    <Database size={15} />
                    Screenpipe
                  </span>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Saved workflows</h3>
                    <p>Workflow drafts, recordings, and run history.</p>
                  </div>
                  <span className="value-label">Configured backend</span>
                </div>
                <div className="setting-row">
                  <div>
                    <h3>Template drafts</h3>
                    <p>Your own copy, with automatic saving.</p>
                  </div>
                  <ShieldCheck size={20} className="muted" />
                </div>
              </section>
              <p className="inline-note">
                <CircleHelp size={16} />
                This proposal uses sample data and does not connect to your
                workspace.
              </p>
            </>
          )}
          <footer className="settings-footer">
            <GhostMark size={16} />
            <span>Ghost · Made for the work that matters.</span>
          </footer>
        </div>
      </div>
    );
  }

  function renderRecord() {
    return (
      <div className="record-page">
        <header className="record-heading">
          <a
            className="icon-button"
            href="#editor"
            aria-label="Back to workflow"
          >
            <ArrowLeft size={18} />
          </a>
          <div>
            <h1>Teach a browser step</h1>
            <p>{active.name}</p>
          </div>
          <span className="preview-label">Layout preview</span>
        </header>
        <div className="record-layout">
          <section className="browser-preview">
            <div className="browser-toolbar">
              <ArrowLeft size={15} />
              <ArrowRight size={15} />
              <span>
                <Globe2 size={14} />
                Your browser session
              </span>
              <IconButton
                icon={MoreHorizontal}
                label="Browser options"
                onClick={() =>
                  notify("Browser session controls belong here in the app.")
                }
              />
            </div>
            <div className="browser-placeholder">
              <Globe2 size={36} strokeWidth={1.3} />
              <h2>Your browser, right here.</h2>
              <p>
                Demonstrate the step in the embedded browser.
                <br />
                Ghost records the actions you choose.
              </p>
              <span className="caption">
                No live browser is connected in this proposal.
              </span>
            </div>
            <footer className="record-controls">
              <span className="record-ready">
                <Circle size={13} />
                Ready to record
              </span>
              <button
                className="button primary"
                onClick={() =>
                  notify(
                    "Recording layout only. No browser session was started.",
                  )
                }
              >
                <Video size={16} />
                Start recording
              </button>
            </footer>
          </section>
          <aside className="record-guide">
            <span className="caption">Teaching guide</span>
            <h2>One step at a time.</h2>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>Open the starting page</strong>
                  <p>Choose where this step begins.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Show the actions</strong>
                  <p>Complete the task as you normally would.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Review and save</strong>
                  <p>Check the recording before adding it to your workflow.</p>
                </div>
              </li>
            </ol>
            <p className="inline-note">
              <ShieldCheck size={16} />
              You stay in control of what runs.
            </p>
          </aside>
        </div>
      </div>
    );
  }

  function renderWelcome() {
    return (
      <div className="welcome-page page-scroll">
        <div className="welcome-content">
          <span className="welcome-logo">
            <GhostMark size={48} />
          </span>
          <h1>
            Make room for
            <br />
            <span>your real work.</span>
          </h1>
          <p>
            Ghost turns routines into workflows you can understand, teach, and
            run.
          </p>
          <ol className="welcome-steps">
            {[
              ["Describe a routine", "Start with the work you repeat."],
              ["Make it yours", "Review the steps and teach browser actions."],
              [
                "Run with confidence",
                "Test it first. Schedule it when you’re ready.",
              ],
            ].map(([title, text], i) => (
              <li key={title}>
                <span>{i + 1}</span>
                <div>
                  <h2>{title}</h2>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <button className="button primary" onClick={() => navigate("home")}>
            Create my first workflow <ArrowRight size={16} />
          </button>
          <a className="text-button" href="#home">
            Skip introduction
          </a>
        </div>
      </div>
    );
  }

  function renderSystem() {
    const colors = [
      ["Canvas", "--surface-canvas"],
      ["Sidebar", "--surface-sidebar"],
      ["Raised", "--surface-raised"],
      ["Primary text", "--text-primary"],
      ["Reference blue", "--accent-brand"],
      ["Action blue", "--accent-action"],
    ];
    return (
      <div className="system-page page-scroll">
        <div className="system-content">
          <header className="system-heading">
            <span className="system-version">
              Ghost / Blue <span>01</span>
            </span>
            <h1>
              Less to look at.
              <br />
              <span>More room to work.</span>
            </h1>
            <p>
              A calm system for turning everyday routines into reliable
              workflows.
              <br />
              Built around clarity, familiar controls, and a single blue accent.
            </p>
            <div className="system-meta">
              <span>
                <Monitor size={15} />
                Desktop first
              </span>
              <span>
                <Sun size={15} />
                <Moon size={15} />
                Two considered themes
              </span>
              <span>
                <Layers3 size={15} />
                One shared system
              </span>
            </div>
          </header>
          <section className="system-section" id="foundations">
            <div className="system-section-title">
              <span>01</span>
              <div>
                <h2>Quiet foundations</h2>
                <p>Cool neutrals do the work. Blue tells you where to act.</p>
              </div>
            </div>
            <div className="color-swatches">
              {colors.map(([name, token]) => (
                <div className="swatch" key={token}>
                  <div
                    className="swatch-color"
                    style={{ background: `var(${token})` }}
                  />
                  <strong>{name}</strong>
                  <span>{token.replace("--", "")}</span>
                </div>
              ))}
            </div>
            <p className="foundation-note">
              Reference blue #3478F7 · Action blue #2D6DE0 · White on action
              blue 4.80:1
            </p>
          </section>
          <section className="system-section">
            <div className="system-section-title">
              <span>02</span>
              <div>
                <h2>Type that gets out of the way</h2>
                <p>Inter Variable. One family, three weights, clear levels.</p>
              </div>
            </div>
            <div className="type-specimen">
              <div className="type-large">
                Aa<span>Inter</span>
              </div>
              <div className="type-lines">
                <div>
                  <span className="type-display">Your work, understood.</span>
                  <small>Display · 48 / 1.12 · Regular</small>
                </div>
                <div>
                  <span className="type-title">Weekly team update</span>
                  <small>Page title · 32 / 1.2 · Medium</small>
                </div>
                <div>
                  <span className="type-section">A little less busywork.</span>
                  <small>Section · 20 / 1.4 · Medium</small>
                </div>
                <div>
                  <span className="type-body">
                    Review the steps before anything runs.
                  </span>
                  <small>Body · 16 / 1.5 · Regular</small>
                </div>
                <div>
                  <strong>Run workflow</strong>
                  <small>Control · 14 / 1.4 · Medium</small>
                </div>
                <div>
                  <span className="caption">Edited 12 minutes ago</span>
                  <small>Caption · 12 / 1.5 · Regular</small>
                </div>
              </div>
            </div>
          </section>
          <section className="system-section">
            <div className="system-section-title">
              <span>03</span>
              <div>
                <h2>Familiar pieces. Consistent behavior.</h2>
                <p>One primary action, simple controls, useful feedback.</p>
              </div>
            </div>
            <div className="component-grid">
              <div className="specimen-panel">
                <h3>Actions</h3>
                <div className="component-row">
                  <button
                    className="button primary"
                    onClick={() => setDialog({ kind: "run", workflow: active })}
                  >
                    <Play size={15} />
                    Run workflow
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      setDialog({ kind: "schedule", workflow: active })
                    }
                  >
                    Schedule
                  </button>
                  <button
                    className="text-button"
                    onClick={() => navigate("workflows")}
                  >
                    View all <ArrowRight size={14} />
                  </button>
                </div>
                <div className="component-row">
                  <button className="button secondary" disabled>
                    Saving…
                  </button>
                  <span className="autosave">
                    <Check size={14} />
                    All changes saved
                  </span>
                </div>
                <p className="caption">
                  40 px controls · 8 px corners · 140 ms feedback
                </p>
              </div>
              <div className="specimen-panel">
                <h3>Status is information</h3>
                <div className="component-row">
                  <Status value="Draft" />
                  <Status value="Needs teaching" />
                  <Status value="Ready" />
                </div>
                <p>
                  Always pair a status with an icon and a label. Color supports
                  the meaning.
                </p>
              </div>
              <div className="specimen-panel">
                <h3>Fields</h3>
                <label className="field">
                  Workflow name
                  <input
                    aria-label="Example workflow name"
                    placeholder="e.g. Weekly team update"
                  />
                </label>
                <label className="field">
                  Invalid field
                  <input
                    aria-invalid="true"
                    aria-describedby="name-error"
                    defaultValue=""
                  />
                  <small id="name-error" className="error-text">
                    Give this workflow a name.
                  </small>
                </label>
              </div>
              <div className="specimen-panel">
                <h3>Navigation & selection</h3>
                <div className="nav-specimen">
                  <a href="#home" className="nav-link active">
                    <House size={18} />
                    Home<span className="key-hint">⌘ 1</span>
                  </a>
                  <a href="#workflows" className="nav-link">
                    <WorkflowIcon size={18} />
                    Workflows
                  </a>
                </div>
                <p className="caption">
                  A pale blue selection, readable label, and generous target.
                </p>
              </div>
            </div>
          </section>
          <section className="system-section">
            <div className="system-section-title">
              <span>04</span>
              <div>
                <h2>Space creates the structure</h2>
                <p>
                  Group with proximity. Add a border only when it earns its
                  place.
                </p>
              </div>
            </div>
            <div className="rhythm-board">
              {[4, 8, 12, 16, 24, 32, 48, 64].map((value) => (
                <div key={value}>
                  <span style={{ height: value }} />
                  <strong>{value}</strong>
                  <small>px</small>
                </div>
              ))}
            </div>
            <div className="rules-grid">
              <div>
                <h3>8 / 12 / 16 px</h3>
                <p>Controls, cards, and dialogs each have their own radius.</p>
              </div>
              <div>
                <h3>248 / 72 px</h3>
                <p>
                  Full sidebar and compact rail. The native title bar stays
                  above both.
                </p>
              </div>
              <div>
                <h3>32 / 48 px</h3>
                <p>Page gutters and section breaks, scaled to the window.</p>
              </div>
            </div>
          </section>
          <section className="system-section">
            <div className="system-section-title">
              <span>05</span>
              <div>
                <h2>Designed beyond the happy path</h2>
                <p>Explain the state. Give people a useful next step.</p>
              </div>
            </div>
            <div className="state-specimens">
              <div className="specimen-panel">
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
                <div className="skeleton-line medium" />
                <strong>Loading workflows</strong>
                <p>Keep the final layout stable.</p>
              </div>
              <div className="specimen-panel">
                <WorkflowIcon size={24} className="muted" />
                <h3>Your first workflow starts here</h3>
                <p>Describe a routine to create a draft.</p>
                <button
                  className="text-button"
                  onClick={() => navigate("home")}
                >
                  Create a workflow <ArrowRight size={14} />
                </button>
              </div>
              <div className="specimen-panel">
                <span className="error-text">
                  <CircleHelp size={22} />
                </span>
                <h3>Couldn’t load workflows</h3>
                <p>
                  Your saved work is safe. Check your connection and try again.
                </p>
                <button
                  className="text-button"
                  onClick={() =>
                    notify(
                      "Retry feedback specimen. This preview has no backend connection.",
                    )
                  }
                >
                  Try again <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </section>
          <section className="system-section">
            <div className="system-section-title">
              <span>06</span>
              <div>
                <h2>One system, every part of Ghost</h2>
                <p>Explore the proposed page structure and interactions.</p>
              </div>
            </div>
            <div className="layout-links">
              {(
                [
                  [House, "Home", "A focused starting point.", "home"],
                  [
                    WorkflowIcon,
                    "Workflows",
                    "Cards, drafts, and templates.",
                    "workflows",
                  ],
                  [GitBranch, "Editor", "The canvas gets the space.", "editor"],
                  [
                    Video,
                    "Teaching",
                    "Browser first. Guidance beside it.",
                    "record",
                  ],
                  [
                    Settings2,
                    "Settings",
                    "Clear groups, useful defaults.",
                    "settings",
                  ],
                  [
                    GhostMark,
                    "Introduction",
                    "Three steps. One next action.",
                    "welcome",
                  ],
                ] as const
              ).map(([Icon, title, text, target]) => (
                <a href={`#${target}`} key={target}>
                  <Icon size={20} />
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </a>
              ))}
            </div>
          </section>
          <footer className="system-footer">
            <GhostMark size={22} />
            <p>
              Design proposal only. No application files, workflows, or settings
              have been changed.
            </p>
            <a
              href="./DESIGN-SYSTEM.md"
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              Read the specification <ArrowUpRight size={15} />
            </a>
          </footer>
        </div>
      </div>
    );
  }

  function renderDialog() {
    if (!dialog) return null;
    const close = () => setDialog(null);
    const workflow = dialog.workflow ?? active;
    if (dialog.kind === "search") {
      const found = workflows.filter((w) =>
        `${w.name} ${w.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
      return (
        <Modal title="Search your workspace" onClose={close} wide>
          <label className="command-search">
            <Search size={21} />
            <input
              autoFocus
              aria-label="Search workspace"
              placeholder="Search workflows, steps, and actions…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd>esc</kbd>
          </label>
          <div
            className="search-categories"
            role="group"
            aria-label="Search category"
          >
            {["All", "Workflows", "Actions"].map((category) => (
              <button
                key={category}
                className={searchCategory === category ? "active" : ""}
                aria-pressed={searchCategory === category}
                onClick={() => setSearchCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="command-results">
            <p className="caption">
              {search ? "Matching workflows" : "Recent workflows"}
            </p>
            {searchCategory !== "Actions" &&
              found.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    close();
                    openWorkflow(w);
                  }}
                >
                  <WorkflowIcon size={18} />
                  <span>
                    <strong>{w.name}</strong>
                    <small>
                      {w.nodes.length} nodes · {w.status}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            {!found.length && searchCategory !== "Actions" && (
              <p className="no-results">
                No workflows match “{search}”. Try another name.
              </p>
            )}
            {searchCategory !== "Workflows" && (
              <>
                <p className="caption">Quick actions</p>
                <button onClick={() => setDialog({ kind: "create" })}>
                  <Plus size={18} />
                  <span>New workflow</span>
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => {
                    close();
                    navigate("settings");
                  }}
                >
                  <Settings2 size={18} />
                  <span>Open settings</span>
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
          <footer className="command-footer">
            <span>Tab to navigate</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </footer>
        </Modal>
      );
    }
    if (dialog.kind === "create")
      return (
        <Modal title="Create a workflow" onClose={close}>
          <p className="modal-copy">
            Give your routine a name. You can build the steps as you go.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              createDraft(String(data.get("name")).trim(), []);
            }}
          >
            <label className="field">
              Workflow name
              <input
                name="name"
                autoFocus
                placeholder="e.g. Weekly team update"
                required
                pattern=".*\S.*"
                maxLength={100}
              />
            </label>
            <p className="caption">
              This creates a sample draft in the preview.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={close}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                Create draft <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      );
    if (dialog.kind === "schedule")
      return (
        <Modal title="Schedule workflow" onClose={close}>
          <p className="modal-copy">{workflow.name}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setWorkflows((all) =>
                all.map((w) =>
                  w.id === workflow.id ? { ...w, scheduled: true } : w,
                ),
              );
              close();
              notify(
                "Sample schedule saved in this preview. No automation was created.",
              );
            }}
          >
            <label className="field">
              Repeat
              <select defaultValue="Weekdays">
                <option>Weekdays</option>
                <option>Every day</option>
                <option>Every week</option>
              </select>
            </label>
            <label className="field">
              Time
              <input type="time" defaultValue="09:00" required />
            </label>
            <p className="caption">Preview only · Your device’s local time</p>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={close}
              >
                Cancel
              </button>
              <button type="submit" className="button primary">
                Save schedule
              </button>
            </div>
          </form>
        </Modal>
      );
    if (dialog.kind === "delete")
      return (
        <Modal title="Delete this sample workflow?" onClose={close}>
          <p className="modal-copy">
            “{workflow.name}” will be removed from this preview. Your
            application’s workflows stay unchanged.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={close}>
              Keep workflow
            </button>
            <button
              className="button danger"
              onClick={() => {
                setWorkflows((all) => all.filter((w) => w.id !== workflow.id));
                close();
                if (page === "editor") navigate("workflows");
                notify(
                  "Sample workflow removed. Reload to restore the examples.",
                );
              }}
            >
              Delete workflow
            </button>
          </div>
        </Modal>
      );
    if (dialog.kind === "run")
      return (
        <Modal title="Preview a workflow run" onClose={close}>
          <p className="modal-copy">
            See the proposed result state for “{workflow.name}”. This does not
            execute browser actions or connect to any services.
          </p>
          <div className="run-preview-steps">
            {workflow.nodes.map((node, i) => (
              <div key={i}>
                <span>{i + 1}</span>
                {node.name}
                <Check size={14} />
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={close}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                close();
                setRunResult(true);
                setActiveId(workflow.id);
                navigate("editor");
                setEditorTab("Runs");
                notify(
                  "Showing sample run results. No external actions were performed.",
                );
              }}
            >
              <Play size={15} />
              Show sample result
            </button>
          </div>
        </Modal>
      );
    if (dialog.kind === "node")
      return (
        <Modal title="Add a node" onClose={close}>
          <p className="modal-copy">Choose the kind of step you need.</p>
          <div className="node-choices">
            {(
              [
                [
                  Globe2,
                  "Browser step",
                  "Teach Ghost an action in your browser.",
                  "browser",
                ],
                [
                  Braces,
                  "Action",
                  "Transform or prepare information.",
                  "action",
                ],
                [
                  CalendarClock,
                  "Trigger",
                  "Choose how the workflow starts.",
                  "trigger",
                ],
              ] as const
            ).map(([Icon, title, description, kind]) => (
              <button
                key={kind}
                onClick={() => {
                  updateActive({
                    nodes: [
                      ...active.nodes,
                      {
                        name: title,
                        detail: description,
                        kind,
                        state: "Needs teaching",
                      },
                    ],
                  });
                  close();
                  notify("Sample node added.");
                }}
              >
                <span className="choice-icon">
                  <Icon size={20} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </Modal>
      );
    if (dialog.kind === "connection")
      return (
        <Modal title="Add a connection" onClose={close}>
          <p className="modal-copy">
            Connect two steps to define the next action.
          </p>
          {active.nodes.length < 2 ? (
            <p className="inline-note">
              Add at least two nodes before connecting them.
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                close();
                notify(
                  "Connection interaction previewed. The sample canvas uses a fixed sequence.",
                );
              }}
            >
              <label className="field">
                From
                <select>
                  {active.nodes.map((node, i) => (
                    <option key={i}>{node.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                To
                <select defaultValue={active.nodes[1]?.name}>
                  {active.nodes.map((node, i) => (
                    <option key={i}>{node.name}</option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={close}
                >
                  Cancel
                </button>
                <button type="submit" className="button primary">
                  Add connection
                </button>
              </div>
            </form>
          )}
        </Modal>
      );
    if (dialog.kind === "import")
      return (
        <Modal title="Import a workflow" onClose={close}>
          <p className="modal-copy">
            Choose a workflow JSON file to explore the import layout. No file is
            uploaded and no application data is changed.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const file = data.get("workflow-file") as File;
              createDraft(
                file.name.replace(/\.json$/i, "") || "Imported workflow",
                [],
              );
            }}
          >
            <label className="field">
              Workflow file
              <input
                name="workflow-file"
                type="file"
                accept=".json,application/json"
                required
              />
            </label>
            <p className="caption">
              The preview creates an empty sample draft named after the file.
              JSON validation and graph import remain part of the existing app.
            </p>
            <div className="modal-actions">
              <button
                className="button secondary"
                type="button"
                onClick={close}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                Preview import
              </button>
            </div>
          </form>
        </Modal>
      );
    if (dialog.kind === "share")
      return (
        <Modal title="Share workflow" onClose={close}>
          <p className="modal-copy">
            Sharing stays a secondary action beside Run. The application’s
            existing export and sharing behavior would be preserved.
          </p>
          <div className="inline-note">
            <ShieldCheck size={18} />
            This design preview does not publish or upload workflows.
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={close}>
              Close
            </button>
          </div>
        </Modal>
      );
    if (dialog.kind === "source")
      return (
        <Modal title="Discover from your activity" onClose={close}>
          <p className="modal-copy">
            Ghost looks for repeated steps in your configured local Screenpipe
            history.
          </p>
          <label className="field">
            Time range
            <select defaultValue="Last 7 days">
              <option>Today</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>
          </label>
          <p className="inline-note">
            <Database size={17} />
            No Screenpipe history is accessed by this preview.
          </p>
          <div className="modal-actions">
            <button className="button primary" onClick={close}>
              Done
            </button>
          </div>
        </Modal>
      );
    return (
      <Modal title="From routine to workflow" onClose={close}>
        <div className="help-steps">
          {[
            ["Describe", "Tell Ghost about a routine you repeat."],
            [
              "Review & teach",
              "Check the steps and demonstrate browser actions.",
            ],
            [
              "Test & run",
              "Review a test result before running or scheduling.",
            ],
          ].map(([title, text], i) => (
            <div key={title}>
              <span className="step-number">{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="button primary" onClick={close}>
            Got it
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="preview-bar">
        <a href="#home" className="study-brand">
          Ghost <span>/ Blue</span>
        </a>
        <span className="proposal-tag">Design proposal</span>
        <nav aria-label="Preview navigation">
          <a href="#home" className={page !== "system" ? "active" : ""}>
            Product preview
          </a>
          <a href="#system" className={page === "system" ? "active" : ""}>
            Design system
          </a>
        </nav>
        <ThemeControl theme={theme} setTheme={setTheme} />
      </div>
      <div className={`desktop ${collapsed ? "is-collapsed" : ""}`}>
        <div className="window-chrome">
          <div className="chrome-controls">
            <IconButton
              icon={collapsed ? PanelLeftOpen : PanelLeftClose}
              label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed(!collapsed)}
            />
          </div>
          <span>
            Ghost<span className="dot-separator">/</span>Personal workspace
          </span>
          <span className="chrome-caption">Sample data</span>
        </div>
        <div className="workspace">
          <aside className="sidebar" aria-label="Main navigation">
            <a className="brand" href="#home" aria-label="Ghost home">
              <GhostMark size={25} />
              <span>
                ghost<span className="brand-period">.</span>
              </span>
            </a>
            <button
              className="sidebar-search"
              onClick={() => {
                setSearch("");
                setDialog({ kind: "search" });
              }}
              aria-label="Search workspace"
            >
              <Search size={17} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <nav className="primary-nav">
              <SidebarLink to="home" icon={House} label="Home" />
              <SidebarLink
                to="workflows"
                icon={WorkflowIcon}
                label="Workflows"
              />
            </nav>
            <div className="sidebar-recents">
              <h2>Recent workflows</h2>
              <div className="recent-nav">
                {workflows.slice(0, 4).map((w) => (
                  <button
                    key={w.id}
                    title={w.name}
                    onClick={() => openWorkflow(w)}
                  >
                    <span className="recent-dot" />
                    <span>{w.name}</span>
                  </button>
                ))}
              </div>
              <button
                className="sidebar-template-link"
                onClick={() => {
                  setFilter("Templates");
                  navigate("workflows");
                }}
              >
                <BookOpen size={15} />
                Browse templates
                <ArrowUpRight size={13} />
              </button>
            </div>
            <footer className="sidebar-footer">
              <SidebarLink to="settings" icon={Settings2} label="Settings" />
              <button
                className="nav-link tip"
                aria-label="Help & shortcuts"
                data-tip="Help & shortcuts"
                onClick={() => setDialog({ kind: "help" })}
              >
                <CircleHelp size={18} />
                <span>Help & shortcuts</span>
              </button>
              <div className="workspace-profile">
                <div className="workspace-avatar">
                  <Layers3 size={17} />
                </div>
                <div>
                  <strong>Personal workspace</strong>
                  <span>Local to your device</span>
                </div>
              </div>
            </footer>
          </aside>
          <main
            ref={main}
            tabIndex={-1}
            id="main-content"
            className={`main-content main-${page}`}
          >
            {page === "home"
              ? renderHome()
              : page === "workflows"
                ? renderWorkflows()
                : page === "editor"
                  ? renderEditor()
                  : page === "settings"
                    ? renderSettings()
                    : page === "system"
                      ? renderSystem()
                      : page === "record"
                        ? renderRecord()
                        : renderWelcome()}
          </main>
        </div>
      </div>
      {renderDialog()}
      <div className="toast-region" role="status" aria-live="polite">
        {notice && (
          <div className="toast">
            <Check size={17} />
            <span>{notice}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
