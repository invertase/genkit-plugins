import { generate } from "@genkit-ai/ai";
import { configureGenkit } from "@genkit-ai/core";
import { defineFlow, startFlowsServer } from "@genkit-ai/flow";
import { pgVectorIndexer } from "./indexer";
import { pgVectorRetriever } from "./retriever";
import { genkitPlugin, PluginProvider } from "@genkit-ai/core";
import * as z from "zod";
import { PgVectorPluginParams } from "./types";

const PLUGIN_NAME = "pgvector";

export function pgVector<EmbedderCustomOptions extends z.ZodTypeAny>(
  params: PgVectorPluginParams<z.ZodTypeAny>[]
): PluginProvider {
  const plugin = genkitPlugin(
    PLUGIN_NAME,
    async (params: PgVectorPluginParams<z.ZodTypeAny>[]) => ({
      retrievers: params.map((i) => pgVectorRetriever(i)),
      indexers: params.map((i) => pgVectorIndexer(i)),
    })
  );
  return plugin(params);
}
