import { FlowGraph } from "../flow-graph/FlowGraph";
import FlowManager from "../../FlowManager";

export const runExecutionOrder = async (
  order: string[],
  graph: FlowGraph,
  flowManager: FlowManager
) => {
  // Process each node according to the execution order
  for (const node of order) {
    const attributes = graph.getNodeAttributes(node);
    const { inputValues, flowId } = attributes;

    // Execute the flow associated with the node and get output values
    let outputValues: Record<string, string | number> = {};

    for (let i = 0; i < 4; i++) {
      if (i === 4) {
        throw new Error("Retry limit exceeded");
      }
      try {
        outputValues = await flowManager.runFlow(flowId, inputValues);
        break;
      } catch (error) {
        console.error(`Error in node ${node}:`, error);
      }
    }

    graph.setNodeAttribute(node, "outputValues", outputValues);

    // Distribute output values to connected nodes
    const outgoingEdges = graph.outEdges(node);
    for (const edge of outgoingEdges) {
      const edgeAttributes = graph.getEdgeAttributes(edge);

      const { target, checkedKeys } = edgeAttributes;
      const targetInputValues = distributeValues(checkedKeys, outputValues);

      // Merge new values into the target node's input values
      const targetAttributes = graph.getNodeAttributes(target);
      graph.setNodeAttribute(target, "inputValues", {
        ...targetAttributes.inputValues,
        ...targetInputValues,
      });
    }

    console.log(`Processed node: ${node}`);
  }
};

function distributeValues(
  checkedKeys: string[],
  outputValues: Record<string, string | number>
) {
  // Filter and map values to pass along based on checked keys
  return Object.fromEntries(
    checkedKeys
      .map((key) => [key, outputValues[key]])
      .filter(([_k, value]) => value !== undefined)
  );
}

const retry = async <T>(fn: () => Promise<T>, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`Error in retry ${i}:`, error);
    }
  }
  throw new Error("Retry limit exceeded");
};
