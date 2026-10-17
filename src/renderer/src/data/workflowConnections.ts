import { isUpstream } from "../../../shared/dataProcessing";

export function workflowConnectionError(
  nodes: { id: string }[],
  connections: string[][],
  source: string,
  target: string,
): string | null {
  if (
    !nodes.some((node) => node.id === source) ||
    !nodes.some((node) => node.id === target)
  )
    return "Choose an existing source and destination node.";
  if (source === target) return "Choose two different nodes.";
  if (connections.some(([from, to]) => from === source && to === target))
    return "These nodes are already connected in this direction.";
  if (
    isUpstream(
      {
        nodes: [],
        edges: connections.map(([sourceNodeId, targetNodeId]) => ({
          sourceNodeId,
          targetNodeId,
        })),
      },
      target,
      source,
    )
  )
    return "This connection would create a loop. Choose a different direction.";
  return null;
}
