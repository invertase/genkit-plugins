import { runExecutionOrder } from "./runExecutionOrder";
import { FlowGraph } from "../flow-graph/FlowGraph";
import { createGraph } from "./createGraph";
import { getExecutionOrder } from "./getExecutionOrder";
import { FlowDiagramData } from "./types";
import { Flow } from "@genkit-ai/flow";
import FlowManager from "../../FlowManager";

export const runFlowDiagram = async (
  flowDiagramData: FlowDiagramData
  // flows: Record<string, Flow>
) => {
  const flowManager = new FlowManager({
    genkitReflectionPort: process.env.GENKIT_REFLECTION_PORT,
    genkitEnv: process.env.GENKIT_ENV,
  });

  const graph = createGraph(flowDiagramData);
  const executionOrder = getExecutionOrder(graph);

  console.log("executionOrder", executionOrder);
  await runExecutionOrder(executionOrder, graph, flowManager);
  return graph;
};
