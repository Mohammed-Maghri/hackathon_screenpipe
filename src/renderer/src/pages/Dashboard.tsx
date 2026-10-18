import { appIdentity } from "../data/appIdentity";
import { AppMark } from "../components/AppMark";
import { HomeActivity } from "../components/HomeActivity";
import "../styles/home-reference.css";
import { HomeHeadline } from "../components/HomeHeadline";
import { workflowClient, preparedDiscovery } from "../data/workflowClient";
import { workflowPrompts, demoWorkflow, matchDemo, type DemoScenario } from "../data/demoDiscovery";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { Database, FileText, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  LoaderCircle,
  RefreshCw,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Check,
  CircleDot,
  Plus,
  Search,
  Workflow,
} from "../components/ImageIcon";
import { TitleBar } from "../components/TitleBar";
import { DashboardDialog } from "../components/DashboardDialog";
import { WorkflowSidebar } from "../components/WorkflowSidebar";
import { addWorkflowDraft } from "../data/workflowStore";
import type {
  SavedWorkflow,
  DiscoveryRequest,
} from "../../../shared/discovery";

type Panel =
  | "examples"
  | "create"
  | "import"
  | "notifications"
  | "profile"
  | "help"
  | null;

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activityDialog,setActivityDialog]=useState(false);
  const [overviewTab,setOverviewTab]=useState('workflows');
  const [connection,setConnection]=useState('Checking Screenpipe…');
  const [prompt, setPrompt] = useState("");
  const demoMode = preparedDiscovery;
  const [demoChoice, setDemoChoice] = useState(false);
  const [range, setRange] =
    useState<import("../../../shared/discovery").DiscoveryRequest["timeRange"]>(
      "Last 7 days",
    );
  const [preparing, setPreparing] = useState(false);
  const [generationStage, setGenerationStage] = useState("");
  const [generation, setGeneration] = useState<{
    request: DiscoveryRequest;
    phase: "activity" | "ai" | "saving" | "failed";
    error?: string;
  } | null>(null);
  const [newWorkflowId, setNewWorkflowId] = useState("");
  const generationRequest = useRef<{ signature: string; id: string } | null>(
    null,
  );
  const preparingRef = useRef(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [workflowsError, setWorkflowsError] = useState("");
  const [pageSize, setPageSize] = useState(() =>
    window.innerHeight >= 850 ? 4 : window.innerHeight >= 700 ? 3 : 1,
  );
  useEffect(() => {
    const resize = () => {
      setPageSize(window.innerHeight >= 850 ? 4 : window.innerHeight >= 700 ? 3 : 1);
      setWorkflowPage(0);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [workflowPage, setWorkflowPage] = useState(0);
  const [workflowTotal, setWorkflowTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const listRequest = useRef(0);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState("");
  const [importError, setImportError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const discoveryRef = useRef<HTMLElement>(null);
  const discovered = savedWorkflows.filter((workflow) =>
    `${workflow.name} ${workflow.description ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  useEffect(() => {
    let active = true;
    const request = ++listRequest.current;
    setWorkflowsLoading(true);
    setWorkflowsError("");
    if (!window.ghost && !preparedDiscovery) {
      setWorkflowsError("Open the desktop app to load your saved workflows.");
      setWorkflowsLoading(false);
      return;
    }
    void workflowClient
      .listWorkflows(workflowPage * pageSize, { limit: pageSize })
      .then((result) => {
        if (!active || request !== listRequest.current) return;
        if (result.ok) {
          setSavedWorkflows(result.items);
          setWorkflowTotal(result.total);
        } else {
          setSavedWorkflows([]);
          setWorkflowsError(result.error);
        }
      })
      .catch(() => {
        if (active && request === listRequest.current) {
          setSavedWorkflows([]);
          setWorkflowsError("Unable to load workflows. Please retry.");
        }
      })
      .finally(() => {
        if (active && request === listRequest.current)
          setWorkflowsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workflowPage, refresh, pageSize]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(
    () =>
      window.ghost?.onDiscoveryProgress((progress) => {
        if (progress.requestId !== generationRequest.current?.id) return;
        setGeneration((current) =>
          current && current.phase !== "failed"
            ? { ...current, phase: progress.phase }
            : current,
        );
        setGenerationStage(
          {
            activity: "Checking Screenpipe discovery…",
            ai: "Screenpipe AI is identifying your workflow…",
            saving: "Formatting with Ghost AI and saving your board…",
          }[progress.phase],
        );
      }),
    [],
  );
  async function generateWorkflow(request: DiscoveryRequest, chosenDemo?: DemoScenario) {
    if (!request.prompt.trim() || preparingRef.current) return;
    if (!window.ghost && !preparedDiscovery) {
      setGenerationMessage(
        "Open Ghost in the desktop app to connect to the backend.",
      );
      return;
    }
    const scenario = demoMode ? chosenDemo ?? matchDemo(request.prompt) : null;
    if (demoMode && !scenario) { setDemoChoice(true); setGenerationMessage('Choose the application for this workflow.'); return; }
    setDemoChoice(false);
    preparingRef.current = true;
    setPreparing(true);
    setGenerationMessage("");
    setWorkflowPage(0);
    setQuery("");
    setGeneration({ request, phase: "activity" });
    setGenerationStage(demoMode ? "Preparing your workflow…" : "Checking Screenpipe discovery…");
    const fail = (error: string) => {
      setGeneration({ request, phase: "failed", error });
      setGenerationMessage("");
    };
    try {
      const signature = JSON.stringify(request);
      if (generationRequest.current?.signature !== signature)
        generationRequest.current = { signature, id: crypto.randomUUID() };
      const result = demoMode && scenario
        ? await workflowClient.createWorkflow(demoWorkflow(scenario, request.prompt))
        : await window.ghost!.discoverWorkflow({ ...request, requestId: generationRequest.current.id });
      if (!result.ok) {
        fail(result.error);
        return;
      }
      const workflow = result.workflow;
      listRequest.current++;
      setWorkflowsLoading(false);
      setSavedWorkflows((current) =>
        [
          {
            ...workflow,
            applicationIcons: [
              ...new Set(
                workflow.nodes.flatMap((node) =>
                  node.config.stepType === "browser"
                    ? ["Chrome"]
                    : typeof node.config.application === "string"
                      ? [node.config.application]
                      : [],
                ),
              ),
            ],
            applications: [
              ...new Set(
                workflow.nodes.flatMap((node) =>
                  typeof node.config.application === "string"
                    ? [node.config.application]
                    : [],
                ),
              ),
            ],
            _count: {
              nodes: workflow.nodes.length,
              edges: workflow.edges.length,
            },
          },
          ...current.filter((item) => item.id !== workflow.id),
        ].slice(0, pageSize),
      );
      setWorkflowTotal((current) => current + 1);
      setWorkflowsError("");
      setNewWorkflowId(workflow.id);
      setRefresh((value) => value + 1);
      setGeneration(null);
      generationRequest.current = null;
      navigate(`/workflows/${workflow.id}`, { state: demoMode ? { assembling: workflow.id } : null });
    } catch {
      fail(
        "Unable to generate this workflow. Retry to recover any saved result.",
      );
    } finally {
      preparingRef.current = false;
      setPreparing(false);
    }
  }
  function addDraft(name: string, description: string, steps: string[] = []) {
    const draft = addWorkflowDraft(name, description, steps);
    navigate(`/workflows/${draft.id}`);
  }
  function createWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      const input = event.currentTarget.elements.namedItem(
        "name",
      ) as HTMLInputElement;
      input.setCustomValidity("Enter a workflow name.");
      input.reportValidity();
      return;
    }
    addDraft(name, String(form.get("description") ?? "").trim());
  }
  async function importWorkflow(file?: File) {
    if (!file) return;
    setImportError("");
    try {
      if (file.size > 100_000)
        throw new Error("Choose a JSON file smaller than 100 KB.");
      const value: unknown = JSON.parse(await file.text());
      if (
        !value ||
        typeof value !== "object" ||
        !("name" in value) ||
        typeof value.name !== "string" ||
        !value.name.trim() ||
        value.name.length > 80
      )
        throw new Error("Include a name between 1 and 80 characters.");
      const record = value as Record<string, unknown>;
      if (
        record.steps !== undefined &&
        (!Array.isArray(record.steps) ||
          record.steps.length > 20 ||
          !record.steps.every(
            (step) => typeof step === "string" && step.length <= 500,
          ))
      )
        throw new Error(
          "Steps must be an array of up to 20 short text instructions.",
        );
      if (
        record.description !== undefined &&
        (typeof record.description !== "string" ||
          record.description.length > 300)
      )
        throw new Error("Description must be text up to 300 characters.");
      addDraft(
        value.name.trim(),
        typeof record.description === "string" ? record.description : "",
        Array.isArray(record.steps) ? (record.steps as string[]) : [],
      );
    } catch (error) {
      setImportError(
        error instanceof SyntaxError
          ? "This file is not valid JSON."
          : error instanceof Error
            ? error.message
            : "Unable to read this file.",
      );
    }
  }
  const panelTitles: Record<Exclude<Panel, null>, string> = {
    examples: "Try a workflow request",
    create: "Start with a possibility.",
    import: "Bring your workflow along.",
    notifications: "You’re all caught up.",
    profile: "Your Ghost workspace.",
    help: "Make a little room in your day.",
  };

  return (
    <div className="dashboard-shell home-dashboard relative flex h-full min-h-0 overflow-hidden bg-canvas font-sans text-ink">
      <WorkflowSidebar
        active="home"
        onPanelChange={(next) => {
          if (next === "settings")
            navigate("/settings", {
              state: {
                returnTo: location.pathname,
                backgroundLocation: location,
              },
            });
          else setPanel(next as Panel);
        }}
      />
      <div className="dashboard-body flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="dashboard-topbar relative flex h-16 shrink-0 items-center gap-4 !border-0 px-10 max-[760px]:px-6 [&>.titlebar]:absolute [&>.titlebar]:inset-0 [&>.titlebar]:h-full">
          {window.ghost?.platform !== "darwin" && <TitleBar />}
          <span className="topbar-context relative z-10 mr-auto text-sm font-normal text-muted">
            Home
          </span>
          <button
            className="text-button relative z-10"
            onClick={() => setActivityDialog(true)}
          >
            View activity
          </button>
          <button
            className="notification-button relative z-10"
            aria-label="Notifications"
            onClick={() => setPanel("notifications")}
          >
            <Bell size={17} />
          </button>
        </header>
        <main className="dashboard-scroll home-fixed-workspace min-h-0 flex-1 overflow-hidden">
          <div className="home-workspace-content mx-auto w-full max-w-[1060px] px-12 pb-10 max-[1200px]:px-8 max-[760px]:px-6">
            <div className="home-welcome"><div><h1>Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}.</h1><p>Turn your activity into workflows.</p></div><div className="home-welcome-actions"><span className="home-connection" data-connected={connection==='Screenpipe connected'}><i/>{connection}</span></div></div>
            <section className="dashboard-hero mx-auto mt-8 max-w-[760px] text-center max-[760px]:mt-4 [@media(max-height:760px)]:mt-3">
              {demoChoice && <div className="mt-3 flex justify-center gap-2">{(['nova','forma'] as const).map(scenario=><button className="dash-button" key={scenario} onClick={()=>void generateWorkflow({prompt,timeRange:range},scenario)}>{scenario==='nova'?'NOVA restocking':'Forma finance'}</button>)}</div>}
              <section
                className="discovery-composer mt-8 text-left"
                aria-label="Find a workflow"
              >
                <form
                  className="rounded-dialog border border-strong bg-panel p-5 shadow-soft focus-within:border-action focus-within:ring-3 focus-within:ring-action-soft max-[760px]:p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void generateWorkflow({ prompt, timeRange: range });
                  }}
                >
                  <HomeHeadline compact active={!!prompt.trim()} busy={preparing} onPrompt={() => promptRef.current?.focus()} />
                  <label className="sr-only" htmlFor="home-workflow-prompt">
                    What would you like to automate?
                  </label>
                  <textarea
                    id="home-workflow-prompt"
                    ref={promptRef}
                    rows={1}
                    aria-label="Describe the process to automate"
                    aria-describedby="home-discovery-source"
                    className="block min-h-12 w-full resize-none border-0 bg-transparent p-0 text-base leading-6 text-ink placeholder:text-muted outline-none focus-visible:outline-none"
                    placeholder="What do you want to automate?"
                    required
                    maxLength={10000}
                    value={prompt}
                    disabled={preparing}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        (event.ctrlKey || event.metaKey) &&
                        event.key === "Enter"
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                  <div className="composer-toolbar mt-4 flex flex-wrap items-center justify-between gap-3">
                    <details className="relative">
                      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-control py-1.5 text-xs text-muted [&::-webkit-details-marker]:hidden">
                        <Database size={15} />
                        {demoMode ? 'Workflow context' : 'Screenpipe history'}
                        <ChevronDown size={12} />
                      </summary>
                      <div className="absolute top-full left-0 z-10 mt-2 w-64 rounded-card border border-line bg-overlay p-4 shadow-float">
                        <label className="grid gap-2 text-xs text-muted">
                          Time range
                          <select
                            aria-label="Activity time range"
                            className="rounded-control border border-strong bg-panel px-3 py-2.5 text-sm text-ink"
                            value={range}
                            disabled={preparing}
                            onChange={(event) =>
                              setRange(event.target.value as typeof range)
                            }
                          >
                            <option>Last 7 days</option>
                            <option>Last 24 hours</option>
                            <option>Last 30 days</option>
                          </select>
                        </label>
                        <p
                          id="home-discovery-source"
                          className="mt-3 text-xs leading-relaxed text-muted"
                        >
                          {demoMode ? 'Prepared demo context. Original prompt is preserved; the draft is saved on this device.' : 'Discovery uses your configured local Screenpipe history.'}
                        </p>
                      </div>
                    </details>
                    <button
                      className="dash-button dash-button--primary ml-auto"
                      type="submit"
                      disabled={preparing}
                      aria-busy={preparing}
                      aria-label="Find my workflow"
                    >
                      {preparing ? (
                        <>
                          <LoaderCircle
                            size={16}
                            className="animate-spin motion-reduce:animate-none"
                          />
                          Generating…
                        </>
                      ) : (
                        <>
                          <span className="sr-only">Find my workflow</span><ArrowRight size={21} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </section>
              <div className="mt-4 flex flex-wrap justify-center gap-2 [&>button]:inline-flex [&>button]:items-center [&>button]:gap-2 [&>button]:rounded-control [&>button]:border [&>button]:border-line [&>button]:px-3 [&>button]:py-2 [&>button]:text-xs [&>button]:text-muted [&>button]:hover:border-action-line [&>button]:hover:bg-action-soft [&>button]:hover:text-action">
                <button
                  onClick={() => {
                    setPrompt(demoMode ? workflowPrompts.nova : "Find my daily reporting process");
                    promptRef.current?.focus();
                  }}
                >
                  <FileText size={14} />
                  {demoMode ? "NOVA · Restock products" : "Team updates"}
                </button>
                <button
                  onClick={() => {
                    setPrompt(demoMode ? workflowPrompts.forma : "Show how I handle customer follow-ups");
                    promptRef.current?.focus();
                  }}
                >
                  <Bell size={14} />
                  {demoMode ? "Forma · Review payments" : "Customer follow-ups"}
                </button>
                <button onClick={() => setPanel("examples")}>
                  <Plus size={14} />
                  More examples
                </button>
              </div>

              {generationMessage && (
                <p className="mt-4 text-sm text-danger" role="alert">
                  {generationMessage}
                </p>
              )}
            </section>
            <div className="home-overview-tabs"><button aria-pressed={overviewTab==='workflows'} onClick={()=>setOverviewTab('workflows')}>Recent workflows</button><button aria-pressed={overviewTab==='activity'} onClick={()=>setOverviewTab('activity')}>Latest activity</button></div>
            <div className="home-overview" data-tab={overviewTab}>
            <section
              className="discovery-panel mt-10"
              ref={discoveryRef}
              aria-labelledby="discovery-title"
              aria-busy={workflowsLoading}
            >
              <div className="panel-heading !mb-5 !gap-3 [&>h2]:!text-base [&>h2]:!font-medium">
                <h2 id="discovery-title">Recent workflows</h2>
                <div className="home-workflow-actions ml-auto flex items-center gap-1">
                  <button
                    className="icon-button"
                    aria-label="Create workflow draft"
                    title="Create workflow draft"
                    onClick={() => setPanel("create")}
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Import workflow JSON"
                    title="Import workflow JSON"
                    onClick={() => setPanel("import")}
                  >
                    <ArrowDownToLine size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Refresh workflows"
                    title="Refresh workflows"
                    disabled={workflowsLoading || preparing}
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="text-button ml-2"
                    onClick={() => navigate("/workflows")}
                  >
                    All workflows <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              {generation && (
                <article
                  className={`generation-card mb-5 rounded-card border p-5 ${generation.phase === "failed" ? "generation-card--failed border-danger-line bg-danger-soft" : "border-line bg-panel"}`}
                  aria-busy={preparing}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-action">
                      {generation.phase === "failed" ? (
                        <CircleDot size={20} />
                      ) : (
                        <LoaderCircle
                          size={20}
                          className="animate-spin motion-reduce:animate-none"
                        />
                      )}
                    </span>
                    <h3 className="text-base font-medium">
                      {generation.phase === "failed"
                        ? "Couldn’t generate this workflow"
                        : "Generating your workflow"}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {generation.request.prompt}
                  </p>
                  <p
                    className="mt-3 text-sm text-muted"
                    role={generation.phase === "failed" ? "alert" : "status"}
                  >
                    {generation.phase === "failed"
                      ? generation.error
                      : generationStage}
                  </p>
                  {generation.phase === "failed" && (
                    <button
                      className="dash-button mt-4"
                      onClick={() => void generateWorkflow(generation.request)}
                    >
                      <RefreshCw size={14} />
                      Retry generation
                    </button>
                  )}
                </article>
              )}
              <div className="discovery-grid grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
                {discovered.map((workflow) => (
                  <div
                    key={workflow.id}
                    data-new-workflow={
                      workflow.id === newWorkflowId || undefined
                    }
                  >
                    <button className="home-workflow-row" onClick={()=>navigate('/workflows/'+workflow.id)}><span className="home-workflow-apps">{[...new Set((workflow.applicationIcons?.length?workflow.applicationIcons:workflow.applications??[]).map(appIdentity))].slice(0,3).map(app=><AppMark key={app} app={app}/>)}{!workflow.applicationIcons?.length&&!workflow.applications?.length&&<span className="home-workflow-initial" aria-label="Workflow">{workflow.name.charAt(0).toUpperCase()}</span>}</span><span className="home-workflow-info"><strong>{workflow.name}</strong><small>{(workflow.applications??[]).join(' · ')||'Open to configure steps'}</small></span><span className="home-workflow-state">{workflow.status==='DRAFT'?'Draft':'Open'}</span><ArrowRight size={15}/></button>
                  </div>
                ))}
              </div>
              {workflowsLoading && !savedWorkflows.length && (
                <div
                  role="status"
                  className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1"
                >
                  {[0, 1].map((index) => (
                    <div
                      key={index}
                      className="h-44 rounded-card border border-line bg-panel p-5"
                    >
                      <div className="h-5 w-20 rounded-control bg-sunken" />
                      <div className="mt-5 h-4 w-3/5 rounded bg-sunken" />
                      <div className="mt-3 h-3 w-2/5 rounded bg-sunken" />
                    </div>
                  ))}
                  <span className="sr-only">Loading workflows…</span>
                </div>
              )}
              {workflowsError && (
                <div className="home-list-error empty-state" role="alert">
                  <Workflow size={25} />
                  <h3 className="text-base font-medium text-ink">
                    Couldn’t load your workflows
                  </h3>
                  <p>{workflowsError}</p>
                  <button
                    className="dash-button mt-2"
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    Retry
                  </button>
                </div>
              )}
              {!workflowsLoading && !savedWorkflows.length && !query && (
                <div className="home-demo-workflows">
                  <small className="text-muted">Demo workflows · Select one to prepare it</small>
                  {[
                    {name:'NOVA — Weekly restocking',app:'Chrome',apps:'Chrome · Excel · Slack',prompt:workflowPrompts.nova},
                    {name:'Forma — Review payments',app:'Gmail',apps:'Chrome · Excel',prompt:workflowPrompts.forma},
                    {name:'Weekly team report',app:'Slack',apps:'Slack · Chrome · Excel',prompt:'Prepare a weekly team report from my activity'},
                    {name:'Organize customer follow-ups',app:'Gmail',apps:'Gmail · Chrome',prompt:'Review customer follow-ups and prepare a summary'},
                  ].slice(0,pageSize).map(item=><button key={item.name} className="home-workflow-row" onClick={()=>{setPrompt(item.prompt);promptRef.current?.focus()}}><AppMark app={item.app}/><span className="home-workflow-info"><strong>{item.name}</strong><small>{item.apps}</small></span><span className="home-workflow-state">Prepare</span><ArrowRight size={15}/></button>)}
                </div>
              )}
              {!workflowsLoading && !!query && !discovered.length && <p className="home-panel-message">No matching workflows. Try a different name.</p>}
              {workflowTotal > pageSize && (
                <div className="workflow-pagination mt-4 flex items-center gap-4 text-xs tabular-nums text-muted">
                  <button
                    className="text-button"
                    disabled={workflowPage === 0 || preparing}
                    onClick={() => setWorkflowPage((value) => value - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {workflowPage + 1} of{" "}
                    {Math.ceil(workflowTotal / pageSize)}
                  </span>
                  <button
                    className="text-button"
                    disabled={
                      (workflowPage + 1) * pageSize >= workflowTotal ||
                      preparing
                    }
                    onClick={() => setWorkflowPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
              <details className="home-workflow-filter mt-5">
                <summary className="w-fit cursor-pointer text-xs text-muted">
                  Filter recent workflows
                </summary>
                <label className="mt-3 flex max-w-80 items-center gap-2 rounded-control border border-strong px-3 py-2 text-muted">
                  <Search size={15} />
                  <input
                    ref={searchRef}
                    aria-label="Search workflows on this page"
                    className="w-full min-w-0 border-0 bg-transparent text-sm outline-none focus-visible:outline-none"
                    placeholder="Search recent workflows…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </details>
            </section>
            <HomeActivity onConnection={setConnection}/>
            </div>
            <ActivityTimeline recent busy={preparing} onDiscover={(selectedRange)=>void generateWorkflow({prompt:prompt.trim()||"Identify the workflow in my recorded activity during the selected time range.",timeRange:"Last 7 days",selectedRange})}/>

            {activityDialog&&<DashboardDialog title="Screenpipe activity" onClose={()=>setActivityDialog(false)}>{<ActivityTimeline
                  busy={preparing}
                  onDiscover={(selectedRange) =>
                    void generateWorkflow({
                      prompt: prompt.trim()
                        ? prompt
                        : "Identify the workflow in my recorded activity during the selected time range.",
                      timeRange: "Last 7 days",
                      selectedRange,
                    })
                  }
                />}</DashboardDialog>}

          </div>
        </main>
      </div>
      {notice && (
        <div className="dashboard-toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}

      {panel && (
        <DashboardDialog
          title={panelTitles[panel]}
          onClose={() => setPanel(null)}
        >
          {panel === "examples" && (
            <div className="grid gap-2">
              {(demoMode ? Object.values(workflowPrompts) : [
                "Find my daily reporting process",
                "Show how I handle customer follow-ups",
                "Create a workflow from my Notion updates",
              ]).map((example) => (
                <button
                  key={example}
                  className="dash-button justify-between text-left whitespace-normal"
                  onClick={() => {
                    setPrompt(example);
                    setPanel(null);
                    requestAnimationFrame(() => promptRef.current?.focus());
                  }}
                >
                  {example}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          )}
          {panel === "create" && (
            <form className="workflow-form" onSubmit={createWorkflow}>
              <p className="modal-copy">
                Give your routine a name. Your draft opens in the editor and
                stays available for this session.
              </p>
              <label>
                Workflow name
                <input
                  name="name"
                  onInput={(event) => event.currentTarget.setCustomValidity("")}
                  placeholder="e.g. Weekly team update"
                  required
                  maxLength={80}
                  autoFocus
                />
              </label>
              <label>
                What would you like to automate?
                <textarea
                  name="description"
                  placeholder="Describe the routine you have in mind…"
                  rows={3}
                  maxLength={300}
                />
              </label>
              <button
                className="dash-button dash-button--primary modal-action"
                type="submit"
              >
                <Plus size={16} /> Create draft
              </button>
            </form>
          )}
          {panel === "import" && (
            <>
              <p className="modal-copy">
                Import a local workflow draft. Use a JSON file with a name, an
                optional description, and an optional list of steps.
              </p>
              <pre className="import-example">
                {
                  '{\n  "name": "Weekly report",\n  "steps": ["Collect weekly totals"]\n}'
                }
              </pre>
              <label className="file-picker">
                <ArrowDownToLine size={20} />
                <span>Choose JSON file</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) =>
                    void importWorkflow(event.target.files?.[0])
                  }
                />
              </label>
              {importError && (
                <p className="form-error" role="alert">
                  {importError}
                </p>
              )}
              <p className="preview-disclosure">
                Files are read locally. Nothing is uploaded or executed.
              </p>
            </>
          )}
          {panel === "notifications" && (
            <>
              <div className="modal-callout">
                <Bell size={25} />
                <div>
                  <strong>A quiet workspace.</strong>
                  <p>No new notifications.</p>
                </div>
              </div>
              <p className="modal-copy">
                Open a workflow’s run log to check its latest execution and
                results.
              </p>
            </>
          )}
          {panel === "help" && (
            <>
              <p className="modal-copy">
                Describe a routine on Home to generate a workflow from your
                Screenpipe history. Open its board to review the steps, teach
                browser actions, and test the result.
              </p>
              <p className="preview-disclosure">
                Screenpipe must be running with the Ghost discovery pipe
                installed. You can also demonstrate browser steps from an
                existing workflow.
              </p>
              <button
                className="dash-button dash-button--primary modal-action"
                onClick={() => navigate("/workflows")}
              >
                Browse workflows <ArrowRight size={15} />
              </button>
            </>
          )}
          {panel === "profile" && (
            <>
              <div className="modal-callout">
                <span className="avatar">G</span>
                <div>
                  <strong>My workspace</strong>
                  <p>Local workspace · No account required</p>
                </div>
              </div>
              <p className="modal-copy">
                Saved workflows and template drafts use your configured backend.
                Imported drafts remain available for this session.
              </p>
            </>
          )}
        </DashboardDialog>
      )}
    </div>
  );
}
