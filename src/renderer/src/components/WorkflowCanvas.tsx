import { GhostLogo } from './GhostLogo';
import { AppMark } from './AppMark';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  useReactFlow,
  useViewport,
  type Node,
  type NodeProps,
  type NodeChange,
  type Edge,
  type EdgeChange,
  type Connection,
  type OnBeforeDelete,
} from "@xyflow/react";
import {
  Braces,
  Clock3,
  Copy,
  Database,
  Expand,
  Globe2,
  Hand,
  Map,
  Minus,
  MousePointer2,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import type { EditorNode } from "../data/editorState";
import type { ProcessingEvent } from "../../../shared/dataProcessing";
import { operations } from "../../../shared/dataProcessing";
import { workflowConnectionError } from "../data/workflowConnections";
import { useAppearance } from "../theme/appearance";
import { CanvasAddMenu } from "./CanvasAddMenu";
import { ToolbarTooltip } from "./ToolbarTooltip";
import { NodeStatusBadge } from "./NodeStatusBadge";
import "@xyflow/react/dist/style.css";
import "../styles/workflow-generation.css";

type GhostNode = Node<
  { item: EditorNode; runState?: ProcessingEvent["status"]; index: number; generationPhase?: number },
  "ghost"
>;
type Props = {
  generating?: boolean;
  onGenerationComplete?: () => void;
  nodes: EditorNode[];
  setNodes: Dispatch<SetStateAction<EditorNode[]>>;
  connections: string[][];
  setConnections: Dispatch<SetStateAction<string[][]>>;
  selectedId: string;
  inspectorNodeId?: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: () => void;
  onAdd: (kind: "Add node" | "Add connection") => void;
  onSearch: () => void;
  onDirty: () => void;
  onNotice: (message: string) => void;
  processingStatus: Record<string, ProcessingEvent>;
};

const GhostCanvasNode = memo(function GhostCanvasNode({
  data,
  selected,
}: NodeProps<GhostNode>) {
  const { item, runState, index } = data;
  const trigger = item.kind === "Trigger" || item.id === "trigger";
  const Icon = trigger
    ? Clock3
    : item.kind === "Data Processing"
      ? Database
      : item.kind === "Browser action"
        ? Globe2
        : Braces;
  const handleClass =
    "!size-3 !border-2 !border-[var(--surface-panel)] !bg-[var(--canvas-edge)] hover:!bg-[var(--accent-brand)] focus-visible:!outline-2 focus-visible:!outline-[var(--focus-ring)]";
  return (
    <div
      className={`canvas-node group/node w-[280px] rounded-card border bg-panel px-4 py-4 text-left text-ink shadow-soft transition-[border-color,box-shadow] motion-reduce:transition-none ${selected ? "is-selected border-action ring-3 ring-action-soft" : "border-strong hover:border-action"} ${runState === "RUNNING" ? "!border-action ring-3 ring-action-soft" : ""} ${item.kind === "Data Processing" ? "data-processing-node" : ""} ${trigger ? "trigger-node !w-[200px] !py-3" : ""} node-${item.id}`}
      data-run-state={runState}
      data-generation-phase={data.generationPhase}
      aria-pressed={selected}
    >
      {!trigger && (
        <Handle
          type="target"
          position={Position.Top}
          className={handleClass}
          aria-label={`Connect into ${item.title}`}
        />
      )}
      <div
        className={`node-heading flex items-center gap-2 text-xs text-muted ${trigger ? "" : "mb-3"}`}
      >
        {!trigger && (item.app || item.kind === "Browser action")
          ? <AppMark app={item.kind === "Browser action" ? "Chrome" : item.app!} />
          : <Icon size={15} strokeWidth={1.7} />}
        <span>
          {trigger
            ? item.title
            : item.kind === "Data Processing"
              ? "Data processing"
              : item.kind === "Browser action"
                ? "Browser"
                : item.kind}
        </span>
        {!trigger && (
          <span className="ml-auto tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>
      {!trigger && (
        <>
          <strong className="block text-sm font-medium leading-snug [overflow-wrap:anywhere]">
            {item.title}
          </strong>
          <p
            className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted"
            title={item.description}
          >
            {item.description ||
              (item.kind === "Data Processing"
                ? operations[item.processing?.operation ?? "read_files"].label
                : "Configure this step.")}
          </p>
          <footer className="mt-4 flex items-center justify-between gap-2">
            <NodeStatusBadge status={item.status} />
            <span className="inline-flex items-center gap-1 text-xs text-muted node-settings-hint">
              <Settings2 size={12} />
              Settings
            </span>
          </footer>
          {runState && (
            <span
              role="status"
              className={`mt-2 block text-xs ${runState === "FAILED" ? "text-danger" : "text-action"}`}
            >
              {runState}
            </span>
          )}
        </>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className={handleClass}
        aria-label={`Connect from ${item.title}`}
      />
    </div>
  );
});
const nodeTypes = { ghost: GhostCanvasNode };
const edgeDefaults = {
  type: "smoothstep",
  style: { stroke: "var(--accent-brand)", strokeWidth: 1.5 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: "var(--accent-brand)",
  },
};

function Canvas({
  nodes,
  setNodes,
  connections,
  setConnections,
  selectedId,
  inspectorNodeId,
  onSelect,
  onOpen,
  onDelete,
  onDuplicate,
  onAdd,
  onSearch,
  onDirty,
  onNotice,
  processingStatus,
  generating = false,
  onGenerationComplete,
}: Props) {
  const { resolved } = useAppearance();
  const [generationTick, setGenerationTick] = useState(0);
  const generationIndex = Math.floor(generationTick / 5);
  const generationPhase = generationTick % 5;
  useEffect(() => {
    if (!generating) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const done = generationIndex >= nodes.length;
    const timer = window.setTimeout(() => {
      if (done) onGenerationComplete?.();
      else setGenerationTick(value => value + 1);
    }, reduced ? 40 : done ? 1400 : [1100, 750, 1300, 750, 1400][generationPhase]);
    return () => window.clearTimeout(timer);
  }, [generating, generationTick, generationIndex, generationPhase, nodes.length, onGenerationComplete]);
  const instance = useReactFlow<GhostNode, Edge>();
  const { zoom } = useViewport();
  const [panMode, setPanMode] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const mapped = useMemo<GhostNode[]>(
    () =>
      nodes.map((item, index) => ({
        id: item.id,
        type: "ghost",
        position: { x: item.x, y: item.y },
        data: { item, index, runState: processingStatus[item.id]?.status, generationPhase: !generating ? undefined : index < generationIndex ? 4 : index === generationIndex && generationPhase >= 1 ? Math.max(0, generationPhase - 2) : -1 },
        selected: item.id === selectedId,
        ariaRole: "button",
        ariaLabel: `${item.title} · ${item.status}. Space selects. Enter opens settings.`,
        domAttributes: { "aria-pressed": item.id === selectedId },
      })),
    [nodes, selectedId, processingStatus, generating, generationIndex, generationPhase],
  );
  const [flowNodes, setFlowNodes] = useState(mapped);
  useEffect(
    () =>
      setFlowNodes((current) =>
        mapped.map((node) => ({
          ...current.find((item) => item.id === node.id),
          ...node,
        })),
      ),
    [mapped],
  );
  const flowEdges = useMemo<Edge[]>(
    () =>
      connections
        .filter(
          ([a, b]) =>
            nodes.some((n) => n.id === a) && nodes.some((n) => n.id === b) && (!generating || nodes.findIndex(n => n.id === b) < generationIndex || (nodes.findIndex(n => n.id === b) === generationIndex && generationPhase >= 2)),
        )
        .map(([source, target]) => ({
          id: `${source}:${target}`,
          source,
          target,
          ariaLabel: `Connection from ${nodes.find(node => node.id === source)?.title} to ${nodes.find(node => node.id === target)?.title}`,
          ...edgeDefaults,
          className: generating ? "board-generation-edge" : undefined,
          style: generating ? { stroke: "var(--accent-brand)", strokeWidth: 2.5 } : edgeDefaults.style,
        })),
    [nodes, connections, generating, generationIndex, generationPhase],
  );
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());
  const edges = useMemo(
    () =>
      flowEdges.map((edge) => ({
        ...edge,
        selected: selectedEdges.has(edge.id),
      })),
    [flowEdges, selectedEdges],
  );
  const onNodesChange = useCallback(
    (changes: NodeChange<GhostNode>[]) => {
      setFlowNodes((current) => applyNodeChanges(changes, current));
      const positions = changes.flatMap((change) =>
        change.type === "position" && change.position ? [change] : [],
      );
      if (positions.length) {
        setNodes((current) =>
          current.map((item) => {
            const change = positions.find((change) => change.id === item.id);
            return change?.type === "position" && change.position
              ? { ...item, x: change.position.x, y: change.position.y }
              : item;
          }),
        );
        onDirty();
      }
      const selection = changes.find(
        (change) => change.type === "select" && change.selected,
      );
      if (selection?.type === "select") onSelect(selection.id);
      else if (
        changes.some(
          (change) =>
            change.type === "select" &&
            !change.selected &&
            change.id === selectedId,
        )
      )
        onSelect("");
    },
    [setNodes, onDirty, onSelect, selectedId],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setSelectedEdges((current) => {
        const next = new Set(current);
        for (const change of changes)
          if (change.type === "select") {
            if (change.selected) next.add(change.id);
            else next.delete(change.id);
          } else if (change.type === "remove") next.delete(change.id);
        return next;
      });
      const deleted = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);
      if (deleted.length) {
        setConnections((current) =>
          current.filter(
            ([source, target]) => !deleted.includes(`${source}:${target}`),
          ),
        );
        onDirty();
      }
    },
    [setConnections, onDirty],
  );
  const valid = (connection: Connection | Edge) =>
    !workflowConnectionError(
      nodes,
      connections,
      connection.source,
      connection.target,
    );
  const connect = (connection: Connection) => {
    const error = workflowConnectionError(
      nodes,
      connections,
      connection.source,
      connection.target,
    );
    if (error) {
      onNotice(error);
      return;
    }
    setConnections((current) => [
      ...current,
      [connection.source, connection.target],
    ]);
    onDirty();
    onNotice("Connection added.");
  };
  const beforeDelete: OnBeforeDelete<GhostNode, Edge> = async ({
    nodes: removedNodes,
    edges: removedEdges,
  }) => {
    if (removedNodes.length) {
      onDelete(removedNodes[0].id);
      return false;
    }
    return { nodes: [], edges: removedEdges };
  };
  useEffect(() => {
    if (!inspectorNodeId) return;
    const timer = setTimeout(() => {
      void instance.fitView({
        nodes: [{ id: inspectorNodeId }],
        padding: 0.6,
        maxZoom: 1,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 140,
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [inspectorNodeId, instance]);
  const selected = nodes.find((node) => node.id === selectedId);
  return (
    <div
      className="workflow-canvas relative min-h-44 flex-1 bg-canvas"
      onKeyDownCapture={(event) => {
        const target = event.target as HTMLElement;
        const node = target.closest<HTMLElement>(".react-flow__node");
        if (node && target === node && event.key === "Enter" && !panMode) {
          event.preventDefault();
          event.stopPropagation();
          onOpen(node.dataset.id!);
        }
      }}
    >
      <ReactFlow<GhostNode, Edge>
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={edgeDefaults}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connect}
        isValidConnection={valid}
        onBeforeDelete={beforeDelete}
        onNodeClick={(_, node) => {
          if (!panMode && !generating) onSelect(node.id);
        }}
        onNodeDoubleClick={(_, node) => {
          if (!panMode && !generating) onOpen(node.id);
        }}
        onPaneClick={() => onSelect("")}
        nodesDraggable={!panMode && !generating}
        nodesConnectable={!panMode && !generating}
        elementsSelectable={!panMode && !generating}
        multiSelectionKeyCode={null}
        panOnScroll
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2.5}
        colorMode={resolved}
        deleteKeyCode={generating ? null : ["Delete", "Backspace"]}
        className="ghost-flow"
        aria-label="Workflow canvas"
        ariaLabelConfig={{
          "node.a11yDescription.default":
            "Press Space to select. Press Enter to open settings. Use arrow keys to move the selected node.",
          "node.a11yDescription.keyboardDisabled":
            "Click to select. Double-click to open settings.",
        }}
      >
        {generating && <Panel position="bottom-center" className="generation-thinking-panel !m-5 rounded-2xl border border-line bg-panel p-4 shadow-soft" data-testid="workflow-generation" data-stage={generationIndex >= nodes.length ? 'ready' : ['thinking','card','arrow','logo','text'][generationPhase]}>
          <div className="flex items-center gap-4">
            <span className="generation-thinking-mark"><GhostLogo compact /></span>
            <div className="min-w-0 flex-1"><p role="status" aria-live="polite" className="text-sm font-medium text-ink">{generationIndex >= nodes.length ? 'Your workflow is ready' : 'Thinking · building your workflow'}{generationIndex < nodes.length && <span aria-hidden="true" className="generation-thinking-dots"><i/><i/><i/></span>}</p>
              {generationIndex < nodes.length && <p className="mt-1 text-xs text-ink">{['Preparing the next step', 'Creating the node', generationIndex === 0 ? 'Setting the starting point' : 'Drawing the connection', 'Adding the app logo', 'Writing the step details'][generationPhase]}</p>}
              <p className="mt-1 text-xs text-muted">{generationIndex >= nodes.length ? 'Saved on this device · ready to edit' : `${nodes[generationIndex]?.app ?? 'Workflow'} · Step ${generationIndex + 1} of ${nodes.length} · Prepared workflow`}</p>
            </div>
            <button className="dash-button shrink-0" onClick={onGenerationComplete}>Show all steps</button>
          </div>
          <div className="generation-thinking-track mt-3"><span style={{width: `${Math.min(100, generationTick / (nodes.length * 5) * 100)}%`}} /></div>
        </Panel>}
        {!generating && <Panel position="top-right" className="canvas-ghost-panel !m-5 max-[760px]:!m-3">
          <button type="button" className="canvas-ghost-guide" onClick={()=>void instance.fitView({padding:.25,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:350})} title="Fit all workflow steps" aria-label="Fit all workflow steps">
            <span className="canvas-ghost-character" aria-hidden="true"><GhostLogo compact/></span>
            <span><strong>{nodes.length} steps <span aria-hidden="true">·</span> {connections.length} connections</strong><small>Fit workflow to view</small></span>
          </button>
        </Panel>}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--canvas-dot)"
        />
        <Panel
          position="top-left"
          className="!m-5 flex items-start gap-5 max-[760px]:!m-3"
        >
          <div
            className="canvas-toolbar grid gap-1 rounded-card border border-line bg-panel p-1.5 shadow-soft [&_.canvas-tool>button]:grid [&_.canvas-tool>button]:size-9 [&_.canvas-tool>button]:place-items-center [&_.canvas-tool>button]:rounded-control [&_.canvas-tool>button]:text-muted [&_.canvas-tool>button]:hover:bg-action-soft [&_.canvas-tool>button]:hover:text-action [&_.canvas-tool>button.is-active]:bg-action-soft [&_.canvas-tool>button.is-active]:text-action"
            aria-label="Canvas tools"
          >
            <ToolbarTooltip label="Select and move nodes">
              <button
                aria-label="Select and move nodes"
                aria-pressed={!panMode}
                className={!panMode ? "is-active" : ""}
                onClick={() => setPanMode(false)}
              >
                <MousePointer2 size={18} />
              </button>
            </ToolbarTooltip>
            <ToolbarTooltip label="Pan canvas">
              <button
                aria-label="Pan canvas"
                aria-pressed={panMode}
                className={panMode ? "is-active" : ""}
                onClick={() => setPanMode(true)}
              >
                <Hand size={18} />
              </button>
            </ToolbarTooltip>
            <CanvasAddMenu onChoose={onAdd} />
            <span className="mx-1 my-1 h-px bg-line" />
            <ToolbarTooltip
              label={
                selected
                  ? "Duplicate selected node"
                  : "Select a node to duplicate"
              }
            >
              <button
                aria-label="Duplicate selected node"
                disabled={!selected}
                onClick={onDuplicate}
              >
                <Copy size={17} />
              </button>
            </ToolbarTooltip>
            <ToolbarTooltip
              label={
                selected ? "Delete selected node" : "Select a node to delete"
              }
            >
              <button
                aria-label="Delete selected node"
                disabled={!selected}
                onClick={() => selected && onDelete(selected.id)}
              >
                <Trash2 size={17} />
              </button>
            </ToolbarTooltip>
            <ToolbarTooltip label="Search workflow steps">
              <button aria-label="Search steps" onClick={onSearch}>
                <Search size={17} />
              </button>
            </ToolbarTooltip>
          </div>
          <p className="pointer-events-none pt-2 text-xs text-muted max-[1050px]:hidden">
            Click to select · Double-click to edit · Drag handles to connect
          </p>
        </Panel>
        <Panel position="bottom-left" className="!m-5 max-[760px]:!m-3">
          <div className="canvas-view-controls flex items-center gap-1 rounded-control border border-line bg-panel p-1 shadow-soft [&_button]:grid [&_button]:size-8 [&_button]:place-items-center [&_button]:rounded-md [&_button]:text-muted [&_button]:hover:bg-sunken [&_button]:hover:text-action">
            <button
              aria-label="Zoom out"
              onClick={() => void instance.zoomOut()}
            >
              <Minus size={15} />
            </button>
            <span className="min-w-11 text-center text-xs tabular-nums text-muted">
              {Math.round(zoom * 100)}%
            </span>
            <button aria-label="Zoom in" onClick={() => void instance.zoomIn()}>
              <Plus size={15} />
            </button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              aria-label="Fit canvas"
              onClick={() =>
                void instance.fitView({ padding: 0.22, maxZoom: 1 })
              }
            >
              <Expand size={16} />
            </button>
            <button
              aria-label="Toggle minimap"
              aria-pressed={minimap}
              onClick={() => setMinimap((value) => !value)}
            >
              <Map size={16} />
            </button>
          </div>
        </Panel>
        {minimap && (
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            nodeColor="var(--surface-sunken)"
            nodeStrokeColor="var(--canvas-edge)"
            maskColor="var(--overlay-backdrop)"
            className="!m-5 !rounded-card !border !border-[var(--border-subtle)] !bg-[var(--surface-panel)]"
          />
        )}
      </ReactFlow>
      {!nodes.length && (
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <h2 className="text-lg font-medium">Start with one step</h2>
          <p className="mt-2 text-sm text-muted">
            Use the plus to add a node to your workflow.
          </p>
        </div>
      )}
    </div>
  );
}
export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
