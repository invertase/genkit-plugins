import { FlowGraph } from "./FlowGraph";
import { z } from "zod";

describe("FlowGraph", () => {
  let graph: FlowGraph;

  beforeEach(() => {
    graph = new FlowGraph({});
  });

  test("addFlowNode should add a node with combined input and output schemas", () => {
    const inputSchema = z.object({ id: z.number() });
    const outputSchema = z.object({ result: z.string() });
    graph.addFlowNode("node1", { id: "1", inputSchema, outputSchema });
    const nodeAnnotation = graph.getFlowNodeAnnotation("node1");

    expect(nodeAnnotation.inputSchema).toEqual(inputSchema);
    expect(nodeAnnotation.outputSchema).toEqual(outputSchema);
  });

  test("addFlowEdge should add an edge with a partial input schema", () => {
    const inputSchema = z.object({ id: z.number() });
    const outputSchema = z.object({ result: z.string() });
    graph.addFlowNode("sourceNode", { id: "1", inputSchema, outputSchema });
    graph.addFlowNode("targetNode", { id: "2", inputSchema, outputSchema });

    const partialInputSchema = z.object({ id: z.number().optional() });
    graph.addFlowEdge("sourceNode", "targetNode", {
      source: "sourceNode",
      target: "targetNode",
      partialInputSchema,
    });
    const edgeAnnotation = graph.getFlowEdgeAnnotation(
      "sourceNode",
      "targetNode"
    );

    expect(edgeAnnotation.partialInputSchema).toEqual(partialInputSchema);
  });
});
