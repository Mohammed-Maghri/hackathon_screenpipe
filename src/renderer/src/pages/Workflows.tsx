import { workflowClient, preparedDiscovery } from "../data/workflowClient";
import type { WorkflowSchedule } from "../../../shared/workflowSchedule";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LayoutGrid, Plus, RefreshCw, Search } from "../components/ImageIcon";
import { WorkflowSidebar } from "../components/WorkflowSidebar";
import { SavedWorkflowCard } from "../components/SavedWorkflowCard";
import { DashboardDialog } from "../components/DashboardDialog";
import { TitleBar } from "../components/TitleBar";
import type { SavedWorkflow } from "../../../shared/discovery";

const tabs = {
  All: undefined,
  Active: "ACTIVE",
  Drafts: "DRAFT",
} as const;
type Tab = keyof typeof tabs;
const pageSize = 20;
export function Workflows() {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("All");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedWorkflow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteRef = useRef(false);
  const [deleteError, setDeleteError] = useState("");
  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([]);
  const [actionTarget, setActionTarget] = useState<SavedWorkflow | null>(null);
  const [actionMode, setActionMode] = useState<"run" | "schedule">("run");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const actionLock = useRef(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      void window.ghost?.automation
        .list()
        .then((items) => {
          if (active) setSchedules(items);
        })
        .catch((cause) => {
          if (active) setActionError(String(cause));
        });
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh]);
  function openAction(workflow: SavedWorkflow, mode: "run" | "schedule") {
    setActionTarget(workflow);
    setActionMode(mode);
    setActionError("");
  }
  async function perform(action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionBusy(true);
    setActionError("");
    try {
      await action();
      setActionTarget(null);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message.replace(
              /^Error invoking remote method '[^']+': (?:Error: )?/,
              "",
            )
          : "Action failed.",
      );
    } finally {
      actionLock.current = false;
      setActionBusy(false);
    }
  }
  async function removeWorkflow() {
    if (!deleteTarget || deleteRef.current) return;
    deleteRef.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      if (!window.ghost && !preparedDiscovery)
        throw new Error("Open Ghost desktop to delete workflows.");
      const result = await workflowClient.deleteWorkflow(deleteTarget.id);
      if (!result.ok) throw new Error(result.error);
      setDeleteTarget(null);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : "Unable to delete workflow.",
      );
    } finally {
      deleteRef.current = false;
      setDeleting(false);
    }
  }
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [createError, setCreateError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(async () => {
      try {
        if (!window.ghost && !preparedDiscovery)
          throw new Error("Open Ghost desktop to load your saved workflows.");
        const result = await workflowClient.listWorkflows(page * pageSize, {
          limit: pageSize,
          status: tabs[tab],
          search: query,
        });
        if (!active) return;
        if (!result.ok) throw new Error(result.error);
        if (page > 0 && !result.items.length) {
          setPage(0);
          return;
        }
        setWorkflows(result.items);
        setTotal(result.total);
      } catch (cause) {
        if (active) {
          setWorkflows([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load workflows. Please retry.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, tab, page, refresh]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingRef.current) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    creatingRef.current = true;
    setCreating(true);
    setCreateError("");
    try {
      if (!window.ghost && !preparedDiscovery)
        throw new Error("Open Ghost desktop to create a workflow.");
      const result = await workflowClient.createWorkflow({
        name,
        description: String(form.get("description") ?? "").trim(),
      });
      if (!result.ok) throw new Error(result.error);
      setCreateOpen(false);
      setTab("Drafts");
      setQuery("");
      setPage(0);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setCreateError(
        cause instanceof Error
          ? cause.message
          : "Unable to save this workflow.",
      );
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }
  return (
    <div className="workflows-page absolute inset-0 flex overflow-hidden bg-canvas font-sans text-ink">
      <WorkflowSidebar />
      <div className="workflows-page-body min-w-0 flex-1 overflow-auto [scrollbar-gutter:stable] [&>.titlebar]:h-14 [&>.titlebar]:border-b [&>.titlebar]:border-line">
        {window.ghost?.platform !== "darwin" && <TitleBar />}
        <main className="workflows-page-content mx-auto max-w-[1300px] px-12 py-12 max-[1200px]:px-8 max-[760px]:px-6 max-[760px]:py-8">
          <div className="workflows-page-title flex items-center justify-between gap-6 max-[650px]:flex-wrap">
            <div>
              <h1 className="text-[32px] font-medium leading-tight tracking-tight max-[760px]:text-[28px]">
                Workflows
              </h1>
              <p className="mt-3 text-sm text-muted">
                Your routines, ready when you need them.
              </p>
            </div>
            <button
              className="dash-button dash-button--primary"
              onClick={() => {
                setCreateError("");
                setCreateOpen(true);
              }}
            >
              <Plus size={16} />
              New workflow
            </button>
          </div>
          <nav
            className="workflow-tabs mt-10 !flex-nowrap !gap-6 !overflow-x-auto !rounded-none border-b border-line !pb-0 [&_button]:!rounded-none [&_button]:!px-0 [&_button]:!pb-3 [&_button]:!text-sm [&_button]:!bg-transparent"
            aria-label="Filter workflows"
          >
            {(Object.keys(tabs) as Tab[]).map((item) => (
              <button
                key={item}
                aria-pressed={tab === item}
                className={`shrink-0 border-b-2 ${tab === item ? "is-active !border-brand !font-medium !text-ink" : "border-transparent text-muted"}`}
                onClick={() => {
                  setTab(item);
                  setPage(0);
                }}
              >
                {item === "All" ? "All workflows" : item}
                {item === "All" && (
                  <span className="!ml-2 !rounded-md !bg-sunken !px-1.5 !text-xs tabular-nums">
                    {tab === "All" && !query ? total : ""}
                  </span>
                )}
              </button>
            ))}
          </nav>
              <div className="workflows-page-filters my-6 flex items-center justify-between gap-4">
                <label className="table-search w-full max-w-[340px] !min-h-10 !border-strong !py-2.5 [&_input]:!text-sm">
                  <Search size={16} />
                  <input
                    type="search"
                    aria-label="Search workflows"
                    placeholder="Search workflows…"
                    maxLength={200}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <button
                  className="text-button shrink-0"
                  aria-label="Refresh workflows"
                  disabled={loading}
                  onClick={() => setRefresh((value) => value + 1)}
                >
                  <RefreshCw size={15} />
                  Refresh
                </button>
              </div>
              {actionError && !actionTarget && (
                <p
                  className="mb-5 rounded-control border border-danger-line bg-danger-soft p-4 text-sm text-danger"
                  role="alert"
                >
                  {actionError}
                </p>
              )}
              <section
                className="workflows-library"
                aria-label="Your workflows"
                aria-busy={loading}
              >
                {loading ? (
                  <div
                    className="workflow-card-grid grid grid-cols-2 gap-5 max-[850px]:grid-cols-1"
                    role="status"
                  >
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="h-60 rounded-card border border-line bg-panel p-5"
                      >
                        <div className="h-5 w-20 rounded-md bg-sunken" />
                        <div className="mt-5 h-4 w-3/5 rounded bg-sunken" />
                        <div className="mt-3 h-3 w-4/5 rounded bg-sunken" />
                      </div>
                    ))}
                    <span className="sr-only">Loading workflows…</span>
                  </div>
                ) : error ? (
                  <div className="empty-state" role="alert">
                    <LayoutGrid size={25} />
                    <h2 className="text-base font-medium text-ink">
                      Couldn’t load your workflows
                    </h2>
                    <p>{error}</p>
                    <button
                      className="dash-button mt-2"
                      onClick={() => setRefresh((value) => value + 1)}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                    <ul className="workflow-card-grid m-0 grid list-none grid-cols-2 gap-5 p-0 min-[1600px]:grid-cols-3 max-[850px]:grid-cols-1">
                      {workflows.map((workflow) => (
                        <li className="min-w-0" key={workflow.id}>
                          <SavedWorkflowCard
                            workflow={workflow}
                            schedules={schedules}
                            onRun={() => openAction(workflow, "run")}
                            onSchedule={() => openAction(workflow, "schedule")}
                            onDelete={() => {
                              setDeleteTarget(workflow);
                              setDeleteError("");
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                    {!workflows.length && (
                      <div className="empty-state">
                        <LayoutGrid size={25} />
                        <h2 className="text-base font-medium text-ink">
                          {query || tab !== "All"
                            ? "No matching workflows"
                            : "Your first workflow starts here"}
                        </h2>
                        <p>
                          {query || tab !== "All"
                            ? "Try a different search or status filter."
                            : "Create a workflow or describe a routine from Home."}
                        </p>
                        <button
                          className="dash-button mt-2"
                          onClick={() => {
                            if (query || tab !== "All") {
                              setQuery("");
                              setTab("All");
                            } else {
                              setCreateError("");
                              setCreateOpen(true);
                            }
                          }}
                        >
                          {query || tab !== "All"
                            ? "Clear filters"
                            : "Create a workflow"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
              {!loading && !error && (
                <div className="workflows-page-pagination mt-6 flex items-center justify-between gap-4 text-xs text-muted max-[650px]:flex-wrap">
                  <p>
                    {total} saved workflow{total === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center gap-4 tabular-nums">
                    <button
                      className="text-button"
                      disabled={page === 0}
                      onClick={() => setPage((value) => value - 1)}
                    >
                      Previous
                    </button>
                    <span>
                      Page {page + 1} of{" "}
                      {Math.max(1, Math.ceil(total / pageSize))}
                    </span>
                    <button
                      className="text-button"
                      disabled={(page + 1) * pageSize >= total}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
        </main>
      </div>
      {actionTarget && (
        <DashboardDialog
          title={
            actionMode === "run"
              ? "Run workflow processing"
              : "Schedule workflow processing"
          }
          onClose={() => {
            if (!actionBusy) setActionTarget(null);
          }}
        >
          <p className="modal-copy">{actionTarget.name}</p>
          <p className="modal-copy">
            Runs saved processing logic on the latest verified browser
            downloads. Browser recordings are not replayed automatically. Run
            them from the canvas first when you need fresh files.
          </p>
          {actionError && <p role="alert">{actionError}</p>}
          {actionMode === "run" ? (
            <button
              className="dash-button dash-button--primary"
              disabled={actionBusy}
              onClick={() =>
                void perform(() =>
                  window.ghost!.automation.run(actionTarget.id),
                )
              }
            >
              {actionBusy ? "Running…" : "Run now"}
            </button>
          ) : (
            <form
              className="workflow-form"
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                void perform(async () => {
                  await window.ghost!.automation.save({
                    workflowId: actionTarget.id,
                    nextRun: new Date(
                      String(values.get("start")),
                    ).toISOString(),
                    intervalMinutes: Number(values.get("interval")),
                  });
                });
              }}
            >
              <p className="modal-copy">
                Ghost must be open and this computer awake. Times use{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}. Missed runs
                execute once when Ghost returns; they do not accumulate.
              </p>
              <label>
                Start time
                <input
                  name="start"
                  type="datetime-local"
                  required
                  disabled={actionBusy}
                  defaultValue={(() => {
                    const saved = schedules.find(
                      (s) => s.workflowId === actionTarget.id,
                    )?.nextRun;
                    const date = saved
                      ? new Date(saved)
                      : new Date(Date.now() + 3600000);
                    return new Date(
                      date.getTime() - date.getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16);
                  })()}
                />
              </label>
              <label>
                Repeat
                <select
                  name="interval"
                  disabled={actionBusy}
                  defaultValue={
                    schedules.find((s) => s.workflowId === actionTarget.id)
                      ?.intervalMinutes ?? 1440
                  }
                >
                  <option value="0">Once</option>
                  <option value="60">Every hour</option>
                  <option value="1440">Every 24 hours</option>
                  <option value="10080">Every 7 days</option>
                </select>
              </label>
              <div className="connection-actions">
                <button
                  className="dash-button dash-button--primary"
                  disabled={actionBusy}
                  type="submit"
                >
                  {actionBusy ? "Saving…" : "Save schedule"}
                </button>
                {schedules.some(
                  (s) => s.workflowId === actionTarget.id && s.nextRun,
                ) && (
                  <button
                    type="button"
                    className="dash-button"
                    disabled={actionBusy}
                    onClick={() =>
                      void perform(() =>
                        window.ghost!.automation.remove(actionTarget.id),
                      )
                    }
                  >
                    Remove schedule
                  </button>
                )}
              </div>
            </form>
          )}
        </DashboardDialog>
      )}
      {deleteTarget && (
        <DashboardDialog
          title="Delete workflow?"
          onClose={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        >
          <p className="modal-copy">
            Delete “{deleteTarget.name}”? Its saved nodes, connections and
            backend run history will be permanently removed. Local recording
            files are kept.
          </p>
          {deleteError && <p role="alert">{deleteError}</p>}
          <div className="connection-actions">
            <button
              className="dash-button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className="dash-button workflow-delete text-danger hover:bg-danger/10 hover:text-danger"
              disabled={deleting}
              onClick={() => void removeWorkflow()}
            >
              {deleting ? "Deleting…" : "Delete workflow"}
            </button>
          </div>
        </DashboardDialog>
      )}
      {createOpen && (
        <DashboardDialog
          title="Create a workflow"
          onClose={() => {
            if (!creating) setCreateOpen(false);
          }}
        >
          <form className="workflow-form" onSubmit={create}>
            <label>
              Workflow name
              <input
                name="name"
                required
                pattern=".*\S.*"
                maxLength={200}
                placeholder="e.g. Weekly team update"
                autoFocus
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                maxLength={10000}
                rows={3}
                placeholder="What would you like to automate?"
              />
            </label>
            {createError && <p role="alert">{createError}</p>}
            <button
              disabled={creating}
              className="dash-button dash-button--primary modal-action"
              type="submit"
            >
              <Plus size={16} />
              {creating ? "Saving…" : "Create draft"}
            </button>
          </form>
        </DashboardDialog>
      )}
    </div>
  );
}
