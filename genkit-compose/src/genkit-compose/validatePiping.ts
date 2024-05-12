import { FlowGraph } from "./types";

export const validateNoDuplicates = (graph: FlowGraph) => {
  const nodes = graph.nodes();

  for (const node of nodes) {
    const inputKeys = graph
      .inEdges(node)
      .map((edge) => graph.getEdgeAttributes(edge))
      .flatMap((a) => a.includeKeys);

    const keyWithDuplicate = inputKeys.find(
      (key) => inputKeys.filter((k) => k === key).length > 1
    );

    if (keyWithDuplicate) {
      throw new Error(
        `Duplicate key ${keyWithDuplicate} found in input piping for node ${node}`
      );
    }
  }
};
