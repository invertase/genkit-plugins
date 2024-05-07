import { FlowGraph } from "../flow-graph/FlowGraph";
import { topologicalSort, hasCycle } from "graphology-dag";

export const getExecutionOrder = (graph: FlowGraph) => {
  if (hasCycle(graph)) {
    throw new Error("The flow diagram contains a cycle.");
  }

  return topologicalSort(graph);
};
