import { embed } from "@genkit-ai/ai/embedder";
import {
  Document,
  defineRetriever,
  retrieverRef,
} from "@genkit-ai/ai/retriever";
import { toSql } from "pgvector";
import { z } from "zod";
import postgres, { Sql } from "postgres";
import { PgVectorPluginParams } from "./types";

const getConfigSchema = (params: {
  tableName: string;
  contentColumnName: string;
  embeddingColumnName: string;
  displayName?: string;
}) => {
  return z.object({
    [params.contentColumnName]: z.string(),
    k: z.number().optional(),
  });
};

export function pgVectorRetriever(params: PgVectorPluginParams<z.ZodTypeAny>) {
  const {
    embedder,
    tableName,
    embedderOptions,
    contentColumnName,
    embeddingColumnName,
  } = params;

  return defineRetriever(
    {
      name: `pgvector/${params.tableName}-${params.contentColumnName}-${params.embeddingColumnName}`,
      configSchema: getConfigSchema(params),
    },
    async (document, options) => {
      const sql: Sql = postgres(params.postgresClientOptions);
      // Check if table exists and create if necessary
      if (params.createTableIfMissing) {
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;

        await sql`
          CREATE TABLE IF NOT EXISTS ${sql(tableName)} (
            id SERIAL PRIMARY KEY,
            ${sql(contentColumnName)} TEXT,
            ${sql(embeddingColumnName)} VECTOR(3)
          )
        `;
      }

      // Check and extract the content to be embedded
      const contentToEmbed = document.content[0].text as string;

      if (typeof contentToEmbed !== "string") {
        throw new Error(`Content for ${contentColumnName} is not a string`);
      }

      // Embed the content
      const embedding = await embed({
        embedder,
        content: contentToEmbed,
        options: embedderOptions,
      });

      const k = options?.k || 10;
      const results = await sql`
      SELECT *, ${sql(embeddingColumnName)} <-> ${toSql(embedding)} as distance
      FROM ${sql(tableName)}
        ORDER BY ${sql(embeddingColumnName)} <-> ${toSql(embedding)}
        LIMIT ${toSql(k)}
      `;

      await sql.end();

      const documents = results.map((result: any) =>
        Document.fromText(result[contentColumnName], {
          ...result,
        }).toJSON()
      );

      return {
        documents,
      };
    }
  );
}

export const pgVectorRetrieverRef = (params: {
  tableName: string;
  contentColumnName: string;
  embeddingColumnName: string;
  displayName?: string;
}) => {
  return retrieverRef({
    name: `pgvector/${params.tableName}-${params.contentColumnName}-${params.embeddingColumnName}`,
    info: {
      label:
        params.displayName ??
        `PgVector - ${params.tableName} - ${params.contentColumnName} - ${params.embeddingColumnName}`,
    },
    configSchema: getConfigSchema(params).optional(),
  });
};
