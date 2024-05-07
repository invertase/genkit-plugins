import { FlowDiagramData } from "./types";
import { FlowGraph } from "../flow-graph/FlowGraph";

export const createGraph = (flowDiagramData: FlowDiagramData) => {
  const graph = new FlowGraph({});
  for (const node of flowDiagramData.nodes) {
    graph.addNode(node.nodeId, {
      flowId: node.flowId,
      inputValues: node.inputValues,
    });
  }
  for (const edge of flowDiagramData.edges) {
    if (edge.checkedKeys && edge.checkedKeys.length > 0) {
      graph.addEdge(edge.source, edge.target, {
        edgeId: edge.edgeId,
        source: edge.source,
        target: edge.target,
        checkedKeys: edge.checkedKeys,
      });
    }
  }
  return graph;
};
