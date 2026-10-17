import { Link } from "react-router";
import {
  CalendarClock,
  Play,
  Trash2,
  Workflow,
  ArrowUpRight,
} from "lucide-react";
import type { SavedWorkflow } from "../../../shared/discovery";
import type { WorkflowSchedule } from "../../../shared/workflowSchedule";
import { AppMark } from "./AppMark";
import { NodeStatusBadge } from "./NodeStatusBadge";

export function SavedWorkflowCard({
  workflow,
  compact = false,
  schedules = [],
  onRun,
  onSchedule,
  onDelete,
}: {
  workflow: SavedWorkflow;
  compact?: boolean;
  schedules?: WorkflowSchedule[];
  onRun?: () => void;
  onSchedule?: () => void;
  onDelete?: () => void;
}) {
  const apps = workflow.applicationIcons?.length
    ? workflow.applicationIcons
    : (workflow.applications ?? []);
  const current = schedules.find(
    (schedule) => schedule.workflowId === workflow.id,
  );
  const actionClass =
    "relative z-10 grid size-8 place-items-center rounded-control text-muted hover:bg-sunken hover:text-action focus-visible:outline-2 focus-visible:outline-action";
  return (
    <article
      className={`workflow-library-card group/card relative isolate flex h-full min-w-0 flex-col rounded-card border border-line bg-panel px-5 pt-5 transition-[border-color,box-shadow] hover:border-strong hover:shadow-soft focus-within:border-action ${compact ? "" : "min-h-60"}`}
      aria-label={workflow.name}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <span className="workflow-library-node-count inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-1 text-xs text-muted">
          <Workflow size={14} aria-hidden="true" />
          <strong className="font-medium tabular-nums">
            {workflow._count.nodes}
          </strong>
          {workflow._count.nodes === 1 ? "node" : "nodes"}
        </span>
        <NodeStatusBadge
          status={
            workflow.status.charAt(0) + workflow.status.slice(1).toLowerCase()
          }
        />
      </header>
      <h2 className="text-base leading-snug font-medium tracking-tight">
        <Link
          className="workflow-library-title block after:absolute after:inset-0 after:z-0 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-3 focus-visible:after:outline-action"
          to={`/workflows/${workflow.id}`}
          title={workflow.name}
        >
          <span className="line-clamp-2 [overflow-wrap:anywhere]">
            {workflow.name}
          </span>
        </Link>
      </h2>
      {!compact && workflow.description && (
        <p
          className="workflow-library-description mt-2 line-clamp-2 text-xs leading-relaxed text-muted"
          title={workflow.description}
        >
          {workflow.description}
        </p>
      )}
      <div className="my-4 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
        {apps.slice(0, 4).map((app, index) => (
          <span
            key={`${app}-${index}`}
            className="inline-flex items-center gap-1.5 [&_.app-mark]:size-5 [&_.app-mark]:rounded-sm"
          >
            <AppMark app={app} />
            <span>{app}</span>
          </span>
        ))}
        {!apps.length && (
          <span>
            {workflow._count.nodes
              ? "Open the canvas to review its steps"
              : "Add your first step"}
          </span>
        )}
      </div>
      <footer className="mt-auto flex min-h-13 items-center justify-between gap-2 border-t border-line text-xs text-muted">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {current?.nextRun ? (
            <>
              <CalendarClock size={13} />
              <time
                className="truncate tabular-nums"
                dateTime={current.nextRun}
              >
                {new Date(current.nextRun).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </>
          ) : (
            <>
              Edited{" "}
              <time
                className="tabular-nums"
                dateTime={workflow.updatedAt}
                title={new Date(workflow.updatedAt).toLocaleString()}
              >
                {new Date(workflow.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </>
          )}
        </span>
        <div className="workflow-card-actions flex shrink-0 items-center">
          {onRun && (
            <button
              className={actionClass}
              aria-label={`Run ${workflow.name}`}
              title="Run workflow"
              disabled={current?.result === "Running…"}
              onClick={onRun}
            >
              <Play size={14} />
            </button>
          )}
          {onSchedule && (
            <button
              className={actionClass}
              aria-label={`Schedule ${workflow.name}`}
              title="Schedule workflow"
              onClick={onSchedule}
            >
              <CalendarClock size={14} />
            </button>
          )}
          {onDelete && (
            <button
              className={`${actionClass} hover:text-danger`}
              aria-label={`Delete ${workflow.name}`}
              title="Delete workflow"
              onClick={onDelete}
            >
              <Trash2 size={14} />
            </button>
          )}
          {!onRun && (
            <span className="inline-flex items-center gap-1.5 group-hover/card:text-action">
              Open <ArrowUpRight size={14} />
            </span>
          )}
        </div>
      </footer>
      {current?.result && (
        <p className="pb-3 text-xs text-muted" title={current.result}>
          Last run: {current.result}
        </p>
      )}
    </article>
  );
}
