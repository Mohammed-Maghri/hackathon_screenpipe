import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowUpRight, Copy, Workflow as WorkflowIcon } from "lucide-react";
import { sampleWorkflows, type Workflow } from "../data/workflows";
import { templateDraft } from "../data/workflowDrafts";
import { AppMark } from "./AppMark";
export function WorkflowTemplates() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function choose(template: Workflow) {
    if (busy.current) return;
    busy.current = true;
    setCreating(template.id);
    setError("");
    try {
      if (!window.ghost)
        throw new Error(
          "Open Ghost desktop to save a template as your own draft.",
        );
      const result = await window.ghost.createWorkflow(templateDraft(template));
      if (!result.ok) throw new Error(result.error);
      if (mounted.current) navigate(`/workflows/${result.workflow.id}`);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to save this template. Please retry.",
        );
    } finally {
      busy.current = false;
      if (mounted.current) setCreating("");
    }
  }
  return (
    <>
      <p className="mb-6 flex items-start gap-2 text-sm leading-relaxed text-muted">
        <Copy size={16} className="mt-1 shrink-0" />
        Using a template creates your own saved draft. The original stays
        unchanged.
      </p>
      <div
        className="template-list !grid !grid-cols-2 !gap-5 max-[850px]:!grid-cols-1"
        aria-busy={Boolean(creating)}
      >
        {sampleWorkflows.slice(0, 3).map((workflow) => (
          <button
            key={workflow.id}
            className="!block !rounded-card !bg-panel !p-5 !shadow-none disabled:cursor-wait disabled:opacity-60"
            aria-label={`Use template: ${workflow.name}`}
            disabled={Boolean(creating)}
            onClick={() => void choose(workflow)}
          >
            <span className="mb-5 flex items-center justify-between text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-1">
                <WorkflowIcon size={14} />
                {workflow.steps.length} steps
              </span>
              <span>Template</span>
            </span>
            <strong className="!text-base !font-medium">{workflow.name}</strong>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {workflow.description}
            </p>
            <span className="mt-4 flex items-center gap-2 [&_.app-mark]:size-5">
              {workflow.apps.map((app) => (
                <AppMark key={app} app={app} />
              ))}
            </span>
            <span className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs text-action">
              {creating === workflow.id ? "Saving draft…" : "Use template"}
              <ArrowUpRight size={15} />
            </span>
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error mt-5" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
