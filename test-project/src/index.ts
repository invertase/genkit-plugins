import { configureGenkit } from "@genkit-ai/core";
import * as z from "zod";
import {
  genkitFlowDiagrams,
  defineFlow,
  startComposeServer,
} from "genkit-compose";
import { vertexAI, geminiPro } from "@genkit-ai/vertexai";
import { generate } from "@genkit-ai/ai";

configureGenkit({
  plugins: [genkitFlowDiagrams({ port: 4003 }), vertexAI()],
  logLevel: "debug",
  enableTracingAndMetrics: true,
});

export const suggestActivityFlow = defineFlow(
  {
    name: "suggestActivityFlow",
    inputSchema: z.object({
      date: z.string(),
      location: z.string(),
      budgetInDollars: z.number(),
    }),
    outputSchema: z.object({
      activity: z.string(),
    }),
  },
  async ({ date, budgetInDollars }) => {
    const llmResponse = await generate({
      model: geminiPro,
      prompt: `Suggest an activity for ${date} at ${location} with a budget of ${budgetInDollars} dollars.`,
      output: {
        format: "json",
        schema: z.object({
          activity: z.string(),
        }),
      },
    });

    return llmResponse.output() || { activity: "No activity found" };
  }
);

export const chooseLocationFlow = defineFlow(
  {
    name: "chooseLocationFlow",
    inputSchema: z.object({
      vibe: z.string(),
    }),
    outputSchema: z.object({
      location: z.string(),
    }),
  },
  async ({ vibe }) => {
    const llmResponse = await generate({
      model: geminiPro,
      prompt: `Choose a location for a ${vibe} vacation.`,
      output: {
        format: "json",
        schema: z.object({
          location: z.string(),
        }),
      },
    });

    return llmResponse.output()!;
  }
);

export const estimateCostFlow = defineFlow(
  {
    name: "estimateCostFlow",
    inputSchema: z.object({
      activity: z.string(),
      location: z.string(),
    }),
    outputSchema: z.object({
      cost: z.number(),
    }),
  },
  async ({ activity, location }) => {
    const llmResponse = await generate({
      model: geminiPro,
      prompt: `Estimate the cost of ${activity} in ${location}.`,
      output: {
        format: "json",
        schema: z.object({
          cost: z.number(),
        }),
      },
    });

    return llmResponse.output()!;
  }
);

startComposeServer({ port: 4003, cors: { origin: "*" } });
