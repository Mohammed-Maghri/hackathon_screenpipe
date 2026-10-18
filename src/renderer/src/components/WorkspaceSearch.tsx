import { workflowClient, preparedDiscovery } from "../data/workflowClient";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, House, Search, Settings2, Workflow } from "lucide-react";
import { DashboardDialog } from "./DashboardDialog";
import type { SavedWorkflow } from "../../../shared/discovery";

export function WorkspaceSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      if (!window.ghost && !preparedDiscovery) {
        setError("Open the desktop app to search saved workflows.");
        setLoading(false);
        return;
      }
      void workflowClient
        .listWorkflows(0, {
          limit: 20,
          ...(query.trim() ? { search: query.trim() } : {}),
        })
        .then((result) => {
          if (!current) return;
          if (result.ok) setItems(result.items);
          else setError(result.error);
        })
        .catch(() => {
          if (current) setError("Couldn’t search workflows. Try again.");
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, retry]);
  const open = (path: string) => {
    onClose();
    navigate(path);
  };
  return (
    <DashboardDialog
      title="Search your workspace"
      onClose={onClose}
      className="workspace-search-dialog !w-[min(640px,calc(100vw-40px))]"
    >
      <label className="flex items-center gap-3 rounded-control border border-strong px-4 py-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-action">
        <Search size={20} className="text-muted" />
        <input
          autoFocus
          aria-label="Search workspace"
          className="w-full min-w-0 border-0 bg-transparent text-base outline-none focus-visible:outline-none"
          placeholder="Search workflows…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={200}
        />
        <kbd className="text-xs text-muted">esc</kbd>
      </label>
      <section
        aria-label="Search results"
        aria-busy={loading}
        className="mt-6 max-h-[45vh] overflow-y-auto"
      >
        <h3 className="mb-3 text-xs font-normal text-muted">
          {query.trim() ? "Matching workflows" : "Recent workflows"}
        </h3>
        {loading ? (
          <p className="py-6 text-sm text-muted" role="status">
            Searching workflows…
          </p>
        ) : error ? (
          <div role="alert" className="py-4 text-sm">
            <p>{error}</p>
            <button
              className="text-button mt-3"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : items.length ? (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => open(`/workflows/${item.id}`)}
              className="flex w-full items-center gap-3 rounded-control px-2 py-3 text-left hover:bg-action-soft focus-visible:bg-action-soft"
            >
              <Workflow size={18} className="text-muted" />
              <span className="min-w-0 flex-1">
                <strong
                  className="block truncate text-sm font-medium"
                  title={item.name}
                >
                  {item.name}
                </strong>
                <span className="mt-1 block text-xs text-muted">
                  {item._count.nodes} nodes · {item.status.toLowerCase()}
                </span>
              </span>
              <ArrowUpRight size={15} className="text-muted" />
            </button>
          ))
        ) : (
          <p role="status" className="py-6 text-sm text-muted">
            No workflows match “{query}”. Try another name.
          </p>
        )}
      </section>
      <section className="mt-5 border-t border-line pt-5">
        <h3 className="mb-2 text-xs font-normal text-muted">Quick actions</h3>
        {[
          { icon: House, label: "Describe a routine", path: "/dashboard" },
          { icon: Workflow, label: "Browse workflows", path: "/workflows" },
          { icon: Settings2, label: "Open settings", path: "/settings" },
        ].map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left text-sm hover:bg-sunken"
            onClick={() => open(path)}
          >
            <Icon size={17} className="text-muted" />
            {label}
            <ArrowUpRight size={14} className="ml-auto text-muted" />
          </button>
        ))}
      </section>
    </DashboardDialog>
  );
}
