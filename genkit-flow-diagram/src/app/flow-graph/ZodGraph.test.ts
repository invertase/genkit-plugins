import { ZodGraph } from "./ZodGraph";
import { z } from "zod";

// Sample Zod schemas for testing
const schemaA = z.object({
  name: z.string(),
  age: z.number(),
});

const schemaB = z.object({
  title: z.string(),
  completed: z.boolean(),
});

// Test suite for ZodGraph class
describe("ZodGraph", () => {
  test("should add and retrieve node schemas correctly", () => {
    const graph = new ZodGraph({});
    const nodeSchemas = {
      user: schemaA,
      task: schemaB,
    };

    graph.addNodeWithSchemas("node1", nodeSchemas);

    // Retrieve the schemas to verify they were added correctly
    const retrievedSchemas = graph.getNodeSchemas("node1");
    expect(retrievedSchemas["user"]).toBe(schemaA);
    expect(retrievedSchemas["task"]).toBe(schemaB);
  });

  test("should throw error when adding a node that already exists", () => {
    const graph = new ZodGraph({});
    graph.addNodeWithSchemas("node1", { user: schemaA });

    expect(() => {
      graph.addNodeWithSchemas("node1", { user: schemaA });
    }).toThrow(Error);
  });

  test("should add and retrieve edge schemas correctly", () => {
    const graph = new ZodGraph({});
    const edgeSchemas = {
      relation: schemaA,
      assignment: schemaB,
    };

    graph.addNodeWithSchemas("node1", { user: schemaA });
    graph.addNodeWithSchemas("node2", { user: schemaA });
    graph.addEdgeWithSchemas("node1", "node2", edgeSchemas);

    const retrievedSchemas = graph.getEdgeSchemas("node1", "node2");
    expect(retrievedSchemas["relation"]).toBe(schemaA);
    expect(retrievedSchemas["assignment"]).toBe(schemaB);
  });

  test("should throw error when adding an edge with non-existent nodes", () => {
    const graph = new ZodGraph({});
    const edgeSchemas = {
      relation: schemaA,
    };

    expect(() => {
      graph.addEdgeWithSchemas("node1", "node3", edgeSchemas);
    }).toThrow(Error);
  });
});
