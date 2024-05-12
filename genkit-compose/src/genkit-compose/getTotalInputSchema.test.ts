import { ZodObject, ZodRawShape, UnknownKeysParam, z } from "zod";
import { addSubschema, getTotalInputsSchema } from "./getTotalInputSchema";
import { FlowGraph } from "./types";
import Graph from "graphology";
import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";
import { defineFlow } from ".";

describe("addSubschema", () => {
  test("should add properties from schema to totalSchema under subschemaName", () => {
    const totalSchema = z.object({});

    try {
      totalSchema.parse({
        subschemaName: {
          key1: "value1",
          key2: 2,
        },
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    const schema = z.object({
      key1: z.string(),
      key2: z.number(),
    });

    const keys = ["key1", "key2"];

    const newTotalSchema = addSubschema(
      totalSchema,
      schema,
      "subschemaName",
      keys
    );

    newTotalSchema.parse({
      subschemaName: {
        key1: "value1",
        key2: 2,
      },
    });
  });
});

describe("getTotalInputSchema", () => {
  test("should get totalInputSchema", () => {
    const testFlow = defineFlow(
      {
        name: "foo",
        inputSchema: z.object({
          input: z.string(),
        }),
        outputSchema: z.object({
          output: z.string(),
        }),
      },
      async (input) => {
        return {
          output: input.input,
        };
      }
    );

    const graph: FlowGraph = new Graph();

    graph.addNode("foo", {
      name: "foo",
      inputValues: {
        hello: "world",
      },
      flow: testFlow,
      schema: {
        inputSchema: {
          zod: testFlow.inputSchema,
          jsonSchema: zodToJsonSchema(
            testFlow.inputSchema!
          ) as JsonSchema7ObjectType,
        },
        outputSchema: {
          zod: testFlow.outputSchema,
          jsonSchema: zodToJsonSchema(
            testFlow.outputSchema!
          ) as JsonSchema7ObjectType,
        },
      },
    });

    const totalInputSchema = getTotalInputsSchema(graph);

    expect(totalInputSchema.shape).toHaveProperty("foo");

    expect(Object.keys(totalInputSchema.shape["foo"].shape)).toEqual(["input"]);
  });
});
