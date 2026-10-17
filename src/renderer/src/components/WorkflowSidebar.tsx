import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router";
import {
  ArrowUpRight,
  BookOpen,
  Bug,
  CircleHelp,
  House,
  Layers3,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Workflow,
} from "lucide-react";
import { GhostLogo } from "./GhostLogo";
import { DashboardDialog } from "./DashboardDialog";
import { WorkspaceChromeContext } from "./WorkspaceFrame";
import { WorkspaceSearch } from "./WorkspaceSearch";
import { useWorkflows } from "../data/workflowStore";
import { setSidebarCollapsed, useSidebarCollapsed } from "../theme/sidebar";
import type { SavedWorkflow } from "../../../shared/discovery";

const navClass =
  "nav-item relative flex h-10 min-w-0 items-center gap-3 rounded-control px-3 text-left font-sans text-sm font-medium text-sidebar-muted transition-colors hover:bg-sunken hover:text-sidebar-ink focus-visible:outline-2 focus-visible:outline-action aria-[current=page]:bg-nav-active aria-[current=page]:text-action";
export function WorkflowSidebar({
  active = "workflows",
  onPanelChange,
}: {
  active?: "home" | "workflows" | "settings";
  onPanelChange?: (panel: string) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const drafts = useWorkflows()
    .filter((item) => !item.persisted && /^[a-f\d-]{36}$/i.test(item.id))
    .slice()
    .reverse();
  const collapsed = useSidebarCollapsed();
  const [panel, setPanel] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [recent, setRecent] = useState<SavedWorkflow[]>([]);
  const [recentState, setRecentState] = useState("loading");
  const controls = useContext(WorkspaceChromeContext);
  const desktopMac = window.ghost?.platform === "darwin";
  const labels = collapsed ? "hidden" : "max-lg:hidden";
  const center = collapsed
    ? "justify-center px-0"
    : "max-lg:justify-center max-lg:px-0";
  useEffect(() => {
    let current = true;
    if (!window.ghost) {
      setRecentState("ready");
      return;
    }
    void window.ghost
      .listWorkflows(0, { limit: 4 })
      .then((result) => {
        if (!current) return;
        if (result.ok) {
          setRecent(result.items);
          setRecentState("ready");
        } else setRecentState("error");
      })
      .catch(() => {
        if (current) setRecentState("error");
      });
    return () => {
      current = false;
    };
  }, [location.pathname]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        location.pathname.startsWith("/settings") ||
        document.querySelector("dialog[open]")
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [location.pathname]);
  const recentItems = [
    ...drafts.map((item) => ({ id: item.id, name: item.name })),
    ...recent,
  ]
    .filter(
      (item, index, list) =>
        list.findIndex((value) => value.id === item.id) === index,
    )
    .slice(0, 4);
  function openPanel(value: string) {
    if (value === "settings") {
      if (!location.pathname.startsWith("/settings"))
        navigate("/settings", {
          state: {
            returnTo: location.pathname + location.search,
            backgroundLocation: location,
          },
        });
    } else if (value === "profile") setPanel("menu");
    else if (onPanelChange) onPanelChange(value);
    else setPanel(value);
  }
  const toolbar = (
    <div className="sidebar-toolbar app-no-drag relative flex h-9 items-center gap-1">
      <button
        type="button"
        className="icon-button size-9 rounded-control"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => setSidebarCollapsed(!collapsed)}
      >
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
      </button>
      {!desktopMac && (
        <button
          className="icon-button"
          aria-label="Workspace menu"
          onClick={() => setPanel("menu")}
        >
          <MoreHorizontal size={17} />
        </button>
      )}
    </div>
  );
  return (
    <>
      {desktopMac && controls && createPortal(toolbar, controls)}
      <aside
        aria-label="Workflow sidebar"
        className={`dashboard-sidebar editor-sidebar relative flex min-h-0 shrink-0 flex-col border-r border-sidebar-line bg-sidebar px-4 pt-7 pb-4 text-sidebar-ink ${collapsed ? "w-18 !px-3" : "w-[248px] max-[1200px]:w-56"} max-lg:w-18 max-lg:px-3`}
      >
        {!desktopMac && toolbar}
        <Link
          to="/dashboard"
          aria-label="Ghost home"
          className={`app-no-drag flex h-9 items-center px-3 ${center} [&_.brand>svg]:h-8 [&_.brand>svg]:w-6.5 ${collapsed ? "[&_.brand>span]:hidden" : "max-lg:[&_.brand>span]:hidden"}`}
        >
          <GhostLogo />
        </Link>
        <button
          className={`sidebar-search mt-8 flex h-10 shrink-0 items-center gap-2.5 rounded-control border border-line bg-canvas px-3 text-xs text-muted hover:border-strong ${center}`}
          onClick={() => setSearchOpen(true)}
          aria-label="Search workspace"
          title="Search workspace"
        >
          <Search size={17} />
          <span className={labels}>Search anything</span>
          <kbd className={`ml-auto whitespace-nowrap text-[11px] ${labels}`}>
            {desktopMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
        <nav
          aria-label="Main navigation"
          className="sidebar-primary-nav mt-5 grid gap-1"
        >
          <Link
            to="/dashboard"
            className={`${navClass} ${center}`}
            aria-label="Home"
            title="Home"
            aria-current={active === "home" ? "page" : undefined}
          >
            <House size={18} strokeWidth={1.7} />
            <span className={labels}>Home</span>
          </Link>
          <Link
            to="/workflows"
            className={`${navClass} ${center}`}
            aria-label="Workflows"
            title="Workflows"
            aria-current={active === "workflows" ? "page" : undefined}
          >
            <Workflow size={18} strokeWidth={1.7} />
            <span className={labels}>Workflows</span>
          </Link>
        </nav>
        <section
          className={`sidebar-recents mt-10 min-h-0 flex-1 overflow-y-auto ${labels}`}
          aria-labelledby="sidebar-recents-heading"
        >
          <h2
            id="sidebar-recents-heading"
            className="px-3 text-xs font-normal tracking-normal text-muted"
          >
            Recent workflows
          </h2>
          <div className="mt-3 grid gap-1">
            {recentItems.map((item) => (
              <Link
                key={item.id}
                to={`/workflows/${item.id}`}
                title={item.name}
                className="sidebar-recent-row flex h-9 min-w-0 items-center gap-2.5 rounded-control px-3 text-xs text-muted hover:bg-sunken hover:text-ink"
              >
                <span className="size-1 shrink-0 rounded-full bg-strong" />
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
            {recentItems.length === 0 && (
              <p className="px-3 py-2 text-xs leading-5 text-muted">
                {recentState === "loading"
                  ? "Loading workflows…"
                  : recentState === "error"
                    ? "Recent workflows unavailable."
                    : "Your recent workflows appear here."}
              </p>
            )}
          </div>
          <Link
            to="/workflows?view=templates"
            className="sidebar-template-link mt-5 flex items-center gap-2 px-3 py-2 text-xs text-muted hover:text-action"
          >
            <BookOpen size={15} />
            Browse templates
            <ArrowUpRight size={13} className="ml-auto" />
          </Link>
        </section>
        <footer className="sidebar-footer mt-auto grid shrink-0 gap-1 pt-6">
          <button
            className={`${navClass} ${center}`}
            aria-label="Settings"
            title="Settings"
            aria-current={active === "settings" ? "page" : undefined}
            onClick={() => openPanel("settings")}
          >
            <Settings2 size={18} strokeWidth={1.7} />
            <span className={labels}>Settings</span>
          </button>
          <button
            className={`${navClass} ${center}`}
            aria-label="Help and shortcuts"
            title="Help and shortcuts"
            onClick={() => openPanel("help")}
          >
            <CircleHelp size={18} strokeWidth={1.7} />
            <span className={labels}>Help & shortcuts</span>
          </button>
          <button
            className={`profile-button mt-5 flex min-h-14 items-center gap-2.5 border-t border-line px-2 pt-4 text-left ${center}`}
            aria-label="My workspace"
            title="My workspace"
            onClick={() => openPanel("profile")}
          >
            <span className="grid size-8.5 shrink-0 place-items-center rounded-control bg-sunken text-muted">
              <Layers3 size={17} />
            </span>
            <span className={`min-w-0 text-xs ${labels}`}>
              <strong className="block font-medium">Personal workspace</strong>
              <span className="mt-0.5 block text-muted">
                Local to your device
              </span>
            </span>
          </button>
        </footer>
      </aside>
      {searchOpen && <WorkspaceSearch onClose={() => setSearchOpen(false)} />}
      {panel && (
        <DashboardDialog
          title={
            panel === "menu"
              ? "Workspace"
              : panel === "diagnostics"
                ? "Diagnostics"
                : panel === "help"
                  ? "How Ghost works"
                  : "My workspace"
          }
          onClose={() => setPanel(null)}
        >
          {panel === "menu" ? (
            <div className="grid gap-3">
              <Link
                className="dash-button justify-start"
                to="/dashboard"
                onClick={() => setPanel(null)}
              >
                <House size={16} />
                Home
              </Link>
              <Link
                className="dash-button justify-start"
                to="/workflows"
                onClick={() => setPanel(null)}
              >
                <Workflow size={16} />
                All workflows
              </Link>
              <button
                className="dash-button justify-start"
                onClick={() => {
                  setPanel(null);
                  openPanel("settings");
                }}
              >
                <Settings2 size={16} />
                Settings
              </button>
              <button
                className="text-button justify-start"
                onClick={() => setPanel("diagnostics")}
              >
                <Bug size={16} />
                Diagnostics
              </button>
            </div>
          ) : (
            <p className="modal-copy">
              {panel === "help"
                ? "Describe a routine on Home, review its steps, then teach Ghost any browser actions it needs. You choose when to test and run it. Press ⌘/Ctrl+K to search your workflows."
                : panel === "diagnostics"
                  ? "Ghost · Version 0.1.0. Open a workflow’s run log to inspect execution details. Recording and workflow tools run in the desktop app."
                  : "Your local Ghost workspace. No account required."}
            </p>
          )}
        </DashboardDialog>
      )}
    </>
  );
}
