import { generate } from "@genkit-ai/ai";
import { configureGenkit } from "@genkit-ai/core";
import { startFlowsServer } from "@genkit-ai/flow";
import { geminiPro } from "@genkit-ai/vertexai";
import * as z from "zod";
import { vertexAI } from "@genkit-ai/vertexai";
import {
  genkitFlowDiagrams,
  defineFlow,
  startFlowGraphServer,
} from "genkit-flow-diagram";

configureGenkit({
  plugins: [
    vertexAI({ location: "us-central1" }),
    genkitFlowDiagrams({ port: 4003 }),
  ],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});

export const fooBarFlow = defineFlow(
  {
    name: "fooBarFlow",
    inputSchema: z.object({ foo: z.string() }),
    outputSchema: z.object({ bar: z.string() }),
  },
  async ({ foo }) => {
    return { bar: "baz" };
  }
);

startFlowGraphServer({
  port: 4003,
  options: {
    defaultPipeStrategy: "exclude",
  },
});
