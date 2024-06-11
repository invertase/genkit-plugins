import { embed } from "@genkit-ai/ai/embedder";
import { defineIndexer, Document, indexerRef } from "@genkit-ai/ai/retriever";
import { convert, PostgresField } from "./convert";
import { toSql } from "pgvector";
import postgres from "postgres";
import { z } from "zod";
import { PgVectorPluginParams } from "./types";

export const PgVectorIndexerOptionsSchema = z.null().optional();

export const pgVectorIndexer = <EmbedderCustomOptions extends z.ZodTypeAny>(
  params: PgVectorPluginParams<z.ZodTypeAny>
) => {
  return defineIndexer(
    {
      name: `pgvector/${params.tableName}-${params.contentColumnName}-${params.embeddingColumnName}`,
      configSchema: PgVectorIndexerOptionsSchema,
    },
    async (
      docs: Document[],
      indexerOptions: z.infer<typeof PgVectorIndexerOptionsSchema>
    ) => {
      const sql = postgres(params.postgresClientOptions);

      if (params.createTableIfMissing) {
        console.debug("Creating table if missing");

        console.debug("Table name", params.tableName);
        console.debug("Content column name", params.contentColumnName);
        console.debug("Embedding column name", params.embeddingColumnName);
        await sql`CREATE EXTENSION IF NOT EXISTS vector`;

        await sql`
          CREATE TABLE IF NOT EXISTS ${sql(params.tableName)} (
            id SERIAL PRIMARY KEY,
            ${sql(params.contentColumnName)} TEXT,
            ${sql(params.embeddingColumnName)} VECTOR(3)
          )
        `;
      }

      for (const doc of docs) {
        if (params.metadataSchema) {
          if (!doc.metadata) {
            throw new Error(
              "Document metadata must be provided when metadataSchema is specified."
            );
          }
          try {
            params.metadataSchema.parse(doc.metadata);
          } catch (e) {
            throw new Error(`Document metadata does not match the schema.`);
          }
        }
      }

      const getSqlEmbedding = async (doc: Document) => {
        const embedding = await embed({
          embedder: params.embedder,
          options: params.embedderOptions,
          content: doc,
        });
        return { doc, sqlEmbedding: toSql(embedding) };
      };

      const sqlEmbeddings = await Promise.all(docs.map(getSqlEmbedding));

      if (params.metadataSchema) {
        const metadataFields = convert(params.metadataSchema);

        const values = sqlEmbeddings.map(({ doc, sqlEmbedding }) => {
          const metadataValues = metadataFields.map(
            (field) => doc.metadata![field.name]
          );

          return [...metadataValues, doc.content, sqlEmbedding];
        });

        const metadataFieldNames = metadataFields
          .map((field: PostgresField) => field.name)
          .join(", ");

        await sql`
          INSERT INTO ${sql(params.tableName)} (${sql(metadataFieldNames)}, ${sql(params.contentColumnName)}, ${sql(params.embeddingColumnName)})
          VALUES ${sql(values)};
        `;
      } else {
        const values = sqlEmbeddings.map(({ doc, sqlEmbedding }) => [
          doc.content[0].text,
          sqlEmbedding,
        ]);

        // TODO: fix any
        await sql`
          INSERT INTO ${sql(params.tableName)} (${sql(params.contentColumnName)}, ${sql(params.embeddingColumnName)})
          VALUES ${sql(values as any)};
        `;

        await sql.end();
      }
    }
  );
};

export const pgvectorIndexerRef = (params: {
  tableName: string;
  embeddingColumnName: string;
  contentColumnName: string;
  displayName?: string;
}) => {
  const ref = indexerRef({
    name: `pgvector/${params.tableName}-${params.contentColumnName}-${params.embeddingColumnName}`,
    info: {
      label:
        params.displayName ??
        `PgVector - ${params.tableName} - ${params.contentColumnName} - ${params.embeddingColumnName}`,
    },
    configSchema: PgVectorIndexerOptionsSchema,
  });

  return ref;
};
