import {
  defineFlow as originalDefineFlow,
  Flow,
  StepsFunction,
} from "@genkit-ai/flow";
import express from "express";
import { CorsOptions } from "cors";
import cors from "cors";
import bodyParser from "body-parser";
import Graph from "graphology";
import {
  findGenkitComposeFile,
  parseAsGraph,
  readAndParseConfigFile,
} from "./getComposeConfig";
import { hasCycle, topologicalSort } from "graphology-dag";
import { SerializedFlowGraph, SerializedFlowGraphSchema } from "./types";
import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";
import { runExecutionOrder } from "./runGraph";
import { validateNoDuplicates } from "./validatePiping";
import {
  getTotalInputsSchema,
  getTotalOutput,
  getTotalOutputSchema,
} from "./getTotalInputSchema";
import z from "zod";

const CREATED_FLOWS = "genkit-flow-diagrams__CREATED_FLOWS";

function createdFlows(): Flow<any, any, any>[] {
  if (global[CREATED_FLOWS] === undefined) {
    global[CREATED_FLOWS] = [];
  }
  return global[CREATED_FLOWS];
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

interface ComposeServerParams {
  port?: number;
  cors?: CorsOptions;
  composeConfigPath?: string;
}

export const startComposeServer = async (params: ComposeServerParams) => {
  const port =
    params?.port || (process.env.PORT ? parseInt(process.env.PORT) : 0) || 4003;
  const app = await getApp(params);

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

/**
 *
 * - get the UI working with the new plugin, add a bit to generate the serialized yaml file
 *
 * - get everything above to be synchronous so it can define a genkit flow
 *
 * - get a simplified workflow/pipeline version working
 */
