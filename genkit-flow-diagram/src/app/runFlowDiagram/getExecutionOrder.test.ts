import { getExecutionOrder } from "./getExecutionOrder";
import { FlowGraph } from "../flow-graph/FlowGraph";

describe("getExecutionOrder", () => {
  test("should throw an error when the graph has a cycle", () => {
    const cyclicGraph = new FlowGraph({});
    cyclicGraph.addNode("A");
    cyclicGraph.addNode("B");
    cyclicGraph.addEdge("A", "B");
    cyclicGraph.addEdge("B", "A"); // Creating a cycle

    expect(() => getExecutionOrder(cyclicGraph)).toThrow(
      "The flow diagram contains a cycle."
    );
  });

  test("should return a valid topological order for an acyclic graph", () => {
    const acyclicGraph = new FlowGraph({});
    acyclicGraph.addNode("A");
    acyclicGraph.addNode("B");
    acyclicGraph.addEdge("A", "B");

    const order = getExecutionOrder(acyclicGraph);
    expect(order).toEqual(["A", "B"]);
  });

  test("should handle a complex acyclic graph correctly", () => {
    const complexGraph = new FlowGraph({});
    complexGraph.addNode("A");
    complexGraph.addNode("B");
    complexGraph.addNode("C");
    complexGraph.addNode("D");
    complexGraph.addNode("E");
    complexGraph.addNode("F");
    complexGraph.addNode("G");

    // Adding edges to form a more complex directed acyclic graph (DAG)
    complexGraph.addEdge("A", "B");
    complexGraph.addEdge("A", "C");
    complexGraph.addEdge("B", "D");
    complexGraph.addEdge("C", "D");
    complexGraph.addEdge("C", "E");
    complexGraph.addEdge("D", "F");
    complexGraph.addEdge("E", "F");
    complexGraph.addEdge("F", "G");

    const order = getExecutionOrder(complexGraph);

    console.log(order);
    // Checking the validity of the topological order. Each node should appear before its successors.
    const indexMap: Record<string, any> = order.reduce(
      (acc, val, idx) => ({ ...acc, [val]: idx }),
      {}
    );
    expect(indexMap["A"]).toBeLessThan(indexMap["B"]);
    expect(indexMap["A"]).toBeLessThan(indexMap["C"]);
    expect(indexMap["B"]).toBeLessThan(indexMap["D"]);
    expect(indexMap["C"]).toBeLessThan(indexMap["D"]);
    expect(indexMap["C"]).toBeLessThan(indexMap["E"]);
    expect(indexMap["D"]).toBeLessThan(indexMap["F"]);
    expect(indexMap["E"]).toBeLessThan(indexMap["F"]);
    expect(indexMap["F"]).toBeLessThan(indexMap["G"]);
    expect(order).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });
});
