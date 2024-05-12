import request from "supertest";
import express from "express";
import { defineFlow, getApp } from "..";
import Graph from "graphology";
import { FlowGraph } from "../types";
import z from "zod";
import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";
import fs from "fs";
import path from "path";

describe("startFlowsComposeServer", () => {
  let app: express.Express | undefined;

  beforeEach(async () => {
    app = undefined as any;
  });

  test("Create fixture", async () => {
    // app = await getApp({});
    // const response = await request(app).get("/introspect");
    // expect(response.status).toBe(200);
    // expect(response.body).toBeDefined();

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

    // const graph: FlowGraph = new Graph()

    graph.addNode("foo", {
      name: "foo",
      inputValues: {
        hello: "world",
      },
      // flow: testFlow,
      schema: {
        inputSchema: {
          // zod: testFlow.inputSchema,
          jsonSchema: zodToJsonSchema(
            testFlow.inputSchema!
          ) as JsonSchema7ObjectType,
        },
        outputSchema: {
          // zod: testFlow.outputSchema,
          jsonSchema: zodToJsonSchema(
            testFlow.outputSchema!
          ) as JsonSchema7ObjectType,
        },
      },
    });

    // const order = ["node1"];

    const fixturePath = path.join(__dirname, "fixtures", "genkit-compose.json");

    fs.writeFileSync(fixturePath, JSON.stringify(graph.toJSON(), null, 2));
  });

  test("Get /introspect should return introspection data", async () => {
    defineFlow(
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

    const app = await getApp({});

    const response = await request(app).get("/introspect");

    expect(response.status).toBe(200);

    expect(response.body).toBeDefined();

    const expectedJsonSchema = zodToJsonSchema(
      z.object({
        foo: z.object({
          input: z.string(),
        }),
      })
    );

    expect(response.body).toEqual(expectedJsonSchema);
  });

  test("POST /runTotalFlow with valid input should process the flow and return outputs", async () => {
    defineFlow(
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
    const app = await getApp({});
    const validInput = {
      foo: {
        input: "hello world",
      },
    }; // Replace with a valid input example based on your totalInputSchema
    const response = await request(app).post("/runTotalFlow").send(validInput);
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body).toEqual({
      foo: {
        output: "hello world",
      },
    });
  });
});
