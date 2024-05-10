import { generate } from "@genkit-ai/ai";
import { configureGenkit } from "@genkit-ai/core";
import { startFlowsServer } from "@genkit-ai/flow";
import { geminiPro } from "@genkit-ai/vertexai";
import * as z from "zod";
import { vertexAI } from "@genkit-ai/vertexai";
import {
  genkitFlowDiagrams,
  defineFlow,
  startComposeServer,
  compose,
} from "genkit-flow-diagram";

configureGenkit({
  plugins: [
    vertexAI({ location: "us-central1" }),
    genkitFlowDiagrams({ port: 4003 }),
  ],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});

export const flow1 = defineFlow(
  {
    name: "flow1",
    inputSchema: z.object({ input1: z.string() }),
    outputSchema: z.object({ input2: z.string() }),
  },
  async ({ input1 }) => {
    return { input2: input1 };
  }
);

export const flow2 = defineFlow(
  {
    name: "flow2",
    inputSchema: z.object({ input2: z.string() }),
    outputSchema: z.object({ output: z.string() }),
  },
  async ({ input2 }) => {
    return { output: input2 };
  }
);

compose(flow1, flow2, ["input2"]);

startComposeServer({
  port: 4003,
});
