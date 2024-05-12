import { configureGenkit } from "@genkit-ai/core";
import * as z from "zod";
import {
  genkitFlowDiagrams,
  defineFlow,
  startComposeServer,
  compose,
} from "genkit-compose";

configureGenkit({
  plugins: [genkitFlowDiagrams({ port: 4003 })],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});

// export const flow1 = defineFlow(
//   {
//     name: "flow1",
//     inputSchema: z.object({ input1: z.string() }),
//     outputSchema: z.object({ input2: z.string() }),
//   },
//   async ({ input1 }) => {
//     return { input2: input1 };
//   }
// );

// export const flow2 = defineFlow(
//   {
//     name: "flow2",
//     inputSchema: z.object({ input2: z.string() }),
//     outputSchema: z.object({ output: z.string() }),
//   },
//   async ({ input2 }) => {
//     return { output: input2 };
//   }
// );

// export const flow3 = defineFlow(
//   {
//     name: "flow3",
//     inputSchema: z.object({ output: z.string() }),
//     outputSchema: z.object({ output1: z.string() }),
//   },
//   async ({ output }) => {
//     return { output1: output };
//   }
// );

// compose(flow1, flow2, ["input2"]);

// compose(flow2, flow3, ["output"]);

export const addFlow = defineFlow(
  {
    name: "addFlow",
    inputSchema: z.object({
      x: z.number(),
      b: z.number(),
    }),
    outputSchema: z.object({
      x: z.number(),
    }),
  },
  async ({ x, b }) => {
    return { x: x + b };
  }
);

export const multiplyFlow = defineFlow(
  {
    name: "multiplyFlow",
    inputSchema: z.object({
      x: z.number(),
      b: z.number(),
    }),
    outputSchema: z.object({
      out: z.number(),
    }),
  },
  async ({ x, b }) => {
    return { out: x * b };
  }
);

startComposeServer({
  port: 4003,
  cors: { origin: "*" },
});
