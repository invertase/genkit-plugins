import {
  defineFlow as originalDefineFlow,
  Flow,
  StepsFunction,
  runFlow,
} from "@genkit-ai/flow";
import express from "express";
import { CorsOptions } from "cors";
import cors from "cors";
import bodyParser from "body-parser";
import Graph, { DirectedGraph } from "graphology";
import {
  findGenkitComposeFile,
  findGenkitComposeFileSync,
  parseAsGraph,
  readAndParseConfigFile,
  readAndParseConfigFileSync,
} from "./getComposeConfig";
import { hasCycle, topologicalSort } from "graphology-dag";
import {
  FlowGraph,
  SerializedFlowGraph,
  SerializedFlowGraphSchema,
} from "./types";
import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";
import { runExecutionOrder } from "./runGraph";
import { validateNoDuplicates } from "./validatePiping";
import {
  getFlatInputsSchema,
  getFlatOutputsSchema,
  getTotalInputsSchema,
  getTotalOutput,
  getTotalOutputSchema,
} from "./getTotalInputSchema";
import * as admin from "firebase-admin";
import z from "zod";

admin.initializeApp();

const CREATED_FLOWS = "genkit-flow-diagrams__CREATED_FLOWS";

function createdFlows(): Flow<any, any, any>[] {
  if (global[CREATED_FLOWS] === undefined) {
    global[CREATED_FLOWS] = [];
  }
  return global[CREATED_FLOWS];
}

const CREATED_EDGES = "genkit-flow-diagrams__CREATED_EDGES";

function createdEdges(): {
  source: string;
  target: string;
  attributes: { includeKeys: string[] };
}[] {
  if (global[CREATED_EDGES] === undefined) {
    global[CREATED_EDGES] = [];
  }
  return global[CREATED_EDGES];
}

export function defineFlow<
  I extends z.AnyZodObject = z.AnyZodObject,
  O extends z.AnyZodObject = z.AnyZodObject,
  S extends z.AnyZodObject = z.AnyZodObject
>(
  config: {
    name: string;
    inputSchema: I;
    outputSchema: O;
    streamSchema?: S;
  },
  steps: StepsFunction<I, O, S>
): Flow<I, O, S> {
  const flow = originalDefineFlow(config, steps);

  createdFlows().push(flow);

  return flow;
}

export function compose(
  flow1: Flow<any, any, any>,
  flow2: Flow<any, any, any>,
  includeKeys: string[]
) {
  createdEdges().push({
    source: flow1.name,
    target: flow2.name,
    attributes: {
      includeKeys,
    },
  });
}

function defaultGraph() {
  const graph: FlowGraph = new DirectedGraph();
  for (const flow of createdFlows()) {
    graph.addNode(flow.name, {
      name: flow.name,
      inputValues: {},
      flow: flow,
      schema: {
        inputSchema: {
          zod: flow.inputSchema,
          jsonSchema: zodToJsonSchema(
            flow.inputSchema
          ) as JsonSchema7ObjectType,
        },
        outputSchema: {
          zod: flow.outputSchema,
          jsonSchema: zodToJsonSchema(
            flow.outputSchema
          ) as JsonSchema7ObjectType,
        },
      },
    });
  }

  for (const edge of createdEdges()) {
    console.log("adding edge", edge);
    graph.addDirectedEdge(edge.source, edge.target, edge.attributes);
  }
  return graph;
}

interface ComposeServerParams {
  port?: number;
  cors?: CorsOptions;
  composeConfigPath?: string;
}

export const startComposeServerAsync = async (params: ComposeServerParams) => {
  const port =
    params?.port || (process.env.PORT ? parseInt(process.env.PORT) : 0) || 4003;
  const app = await getApp(params);

  app.listen(port, () => {
    console.log(`Flow COMPOSE server listening at http://localhost:${port}`);
  });
};

export const startComposeServer = (params: ComposeServerParams) => {
  const port =
    params?.port || (process.env.PORT ? parseInt(process.env.PORT) : 0) || 4003;
  const app = getAppSync(params);

  app.listen(port, () => {
    console.log(`Flow COMPOSE server listening at http://localhost:${port}`);
  });
};

export const getApp = async (params: ComposeServerParams) => {
  const app = express();
  app.use(bodyParser.json());
  if (params?.cors) {
    app.use(cors(params.cors));
  }

  const composeConfigPath =
    params.composeConfigPath || (await findGenkitComposeFile());

  if (!composeConfigPath) {
    throw new Error("No compose config file found");
  }

  const composeConfig = await readAndParseConfigFile(composeConfigPath);

  const graph = parseAsGraph(composeConfig);
  const flows = createdFlows();

  for (const node of graph.nodes()) {
    const flow = flows.find((flow) => flow.name === node);
    if (!flow) {
      throw new Error(`Flow not found: ${node}`);
    }
    graph.setNodeAttribute(node, "flow", flow);
    graph.setNodeAttribute(node, "schema", {
      inputSchema: {
        zod: flow.inputSchema,
        jsonSchema: zodToJsonSchema(flow.inputSchema) as JsonSchema7ObjectType,
      },
      outputSchema: {
        zod: flow.outputSchema,
        jsonSchema: zodToJsonSchema(flow.outputSchema) as JsonSchema7ObjectType,
      },
    });
  }

  if (hasCycle(graph)) {
    throw new Error("The flow diagram contains a cycle.");
  }

  validateNoDuplicates(graph);

  const totalInputSchema = getTotalInputsSchema(graph);
  const totalOutputSchema = getTotalOutputSchema(graph);

  const executionOrder = topologicalSort(graph);

  app.post("/runTotalFlow", async (req, res) => {
    let totalFlowInputValues: z.infer<typeof totalInputSchema> = {};

    try {
      totalFlowInputValues = totalInputSchema.parse(req.body);
    } catch (error) {
      console.error(error);
      res.status(400).send("Invalid input values");
      return;
    }

    Object.entries(totalFlowInputValues).forEach(([node, values]) => {
      graph.setNodeAttribute(
        node,
        "inputValues",
        values as Record<string, any>
      );
    });

    await runExecutionOrder(executionOrder, graph);

    const totalOutputValues = getTotalOutput(graph);

    try {
      totalOutputSchema.parse(totalOutputValues);
    } catch (error) {
      console.error(error);
      res.status(500).send("Invalid output values");
      return;
    }
    res.send(totalOutputValues);
  });

  app.post("/runGraph", async (req, res) => {
    const parsedBody = SerializedFlowGraphSchema.parse(
      req.body
    ) as SerializedFlowGraph;

    const graph = Graph.from(parsedBody);

    if (hasCycle(graph)) {
      throw new Error("The flow diagram contains a cycle.");
    }

    try {
      validateNoDuplicates(graph);
    } catch (error) {
      res.status(400).send("Duplicate keys found in piping.");
    }

    const executionOrder = topologicalSort(graph);

    runExecutionOrder(executionOrder, graph);

    res.send(graph.toJSON());
  });

  app.get("/introspect", (req, res) => {
    res.send(zodToJsonSchema(totalInputSchema));
  });

  return app;
};

export const getAppSync = (params: ComposeServerParams) => {
  const app = express();
  app.use(bodyParser.json());
  if (params?.cors) {
    app.use(cors(params.cors));
  }

  const composeConfigPath =
    params.composeConfigPath || findGenkitComposeFileSync();

  const composeConfig = composeConfigPath
    ? readAndParseConfigFileSync(composeConfigPath)
    : null;

  const graph = composeConfig ? parseAsGraph(composeConfig) : defaultGraph();

  const flows = createdFlows();

  for (const node of graph.nodes()) {
    const flow = flows.find((flow) => flow.name === node);
    if (!flow) {
      throw new Error(`Flow not found: ${node}`);
    }
    graph.setNodeAttribute(node, "flow", flow);
    graph.setNodeAttribute(node, "schema", {
      inputSchema: {
        zod: flow.inputSchema,
        jsonSchema: zodToJsonSchema(flow.inputSchema) as JsonSchema7ObjectType,
      },
      outputSchema: {
        zod: flow.outputSchema,
        jsonSchema: zodToJsonSchema(flow.outputSchema) as JsonSchema7ObjectType,
      },
    });
  }

  if (hasCycle(graph)) {
    throw new Error("The flow diagram contains a cycle.");
  }

  validateNoDuplicates(graph);

  const totalInputSchema = getTotalInputsSchema(graph);
  const totalOutputSchema = getTotalOutputSchema(graph);

  const flatInputsSchema = getFlatInputsSchema(graph);
  const flatOutputsSchema = getFlatOutputsSchema(graph);

  defineFlow(
    {
      name: "service__inputNode",
      inputSchema: flatInputsSchema,
      outputSchema: flatInputsSchema,
    },
    async (inputs) => inputs
  );

  defineFlow(
    {
      name: "service__outputNode",
      inputSchema: flatOutputsSchema,
      outputSchema: flatOutputsSchema,
    },
    async (outputs) => outputs
  );

  defineFlow(
    {
      name: "service__firestoreQuery",
      inputSchema: z.object({
        collection: z.string(),
      }),
      outputSchema: z.object({
        data: z.string(),
      }),
    },
    async ({ collection }) => {
      const snapshot = await admin.firestore().collection(collection).get();
      return { data: JSON.stringify(snapshot.docs.map((doc) => doc.data())) };
    }
  );

  const executionOrder = topologicalSort(graph);

  const totalFlow = originalDefineFlow(
    {
      name: "totalFlow",
      inputSchema: totalInputSchema,
      outputSchema: totalOutputSchema,
    },
    async (input) => {
      Object.entries(input).forEach(([node, values]) => {
        graph.setNodeAttribute(
          node,
          "inputValues",
          values as Record<string, any>
        );
      });

      await runExecutionOrder(executionOrder, graph);

      const totalOutputValues = getTotalOutput(graph);

      return totalOutputValues;
    }
  );

  app.post("/runTotalFlow", async (req, res) => {
    let totalFlowInputValues: z.infer<typeof totalInputSchema> = {};

    try {
      totalFlowInputValues = totalInputSchema.parse(req.body);
    } catch (error) {
      console.error(error);
      res.status(400).send("Invalid input values");
      return;
    }

    const totalOutputValues = await runFlow(totalFlow, totalFlowInputValues);

    try {
      totalOutputSchema.parse(totalOutputValues);
    } catch (error) {
      console.error(error);
      res.status(500).send("Invalid output values");
      return;
    }
    res.send(totalOutputValues);
  });

  app.post("/runGraph", async (req, res) => {
    const parsedBody = SerializedFlowGraphSchema.parse(
      req.body
    ) as SerializedFlowGraph;

    const graph = Graph.from(parsedBody);

    for (const node of parsedBody.nodes) {
      const flow = createdFlows().find((f) => f.name === node.attributes?.name);

      const schema = {
        inputSchema: {
          zod: flow?.inputSchema,
          jsonSchema: zodToJsonSchema(
            flow?.inputSchema
          ) as JsonSchema7ObjectType,
        },
        outputSchema: {
          zod: flow?.outputSchema,
          jsonSchema: zodToJsonSchema(
            flow?.outputSchema
          ) as JsonSchema7ObjectType,
        },
      };

      graph.updateNodeAttributes(node.key, (a) => ({
        ...a,
        flow,
        schema,
      }));
    }

    if (hasCycle(graph)) {
      throw new Error("The flow diagram contains a cycle.");
    }

    try {
      validateNoDuplicates(graph);
    } catch (error) {
      res.status(400).send("Duplicate keys found in piping.");
    }

    const executionOrder = topologicalSort(graph);

    await runExecutionOrder(executionOrder, graph);

    res.send(graph.toJSON());
  });

  app.get("/listFlows", (req, res) => {
    const flows = createdFlows().filter((f) => !f.name.startsWith("service__"));

    const serializedFlows = flows.map((f) => ({
      name: f.name,
      id: f.name,
      inputSchema: zodToJsonSchema(f.inputSchema),
      outputSchema: zodToJsonSchema(f.outputSchema),
    }));

    res.send(serializedFlows);
  });

  app.get("/listServices", (req, res) => {
    const flows = createdFlows();

    const services = flows.filter((f) => f.name.startsWith("service__"));

    res.send(services);
  });

  return app;
};

/**
 *
 *
 * get keys separate from flow names
 *
 * - get a simplified workflow/pipeline version working
 */
