import { textEmbeddingGecko } from "@genkit-ai/vertexai";
import { pgvectorIndexerRef } from "./indexer";
import { z } from "zod";
import { index, retrieve } from "@genkit-ai/ai";
import { configureGenkit } from "@genkit-ai/core";
import { pgVector } from ".";
import { lookupAction } from "@genkit-ai/core/registry";
import { pgVectorRetrieverRef } from "./retriever";
import { Document } from "@genkit-ai/ai/retriever";
import postgres from "postgres";
import { toSql } from "pgvector/utils";

const postgresClientOptions = {
  host: "localhost",
  port: 5432,
  database: "vectordb",
  user: "testuser",
  password: "testpwd",
  ssl: false,
};

configureGenkit({
  plugins: [
    pgVector([
      {
        tableName: "table",
        embeddingColumnName: "embedding",
        contentColumnName: "content",
        embedder: textEmbeddingGecko,
        embedderOptions: {
          dimension: 3,
        },
        createTableIfMissing: true,
        postgresClientOptions,
      },
    ]),
    /* Add your plugins here. */
  ],
  logLevel: "debug",
});

// mock the following
// import { embed } from "@genkit-ai/ai/embedder";

jest.mock("@genkit-ai/ai/embedder", () => {
  return {
    ...jest.requireActual("@genkit-ai/ai/embedder"),
    embed: jest.fn().mockResolvedValue([1, 2, 3]),
  };
});

describe("integration tests for configurePgVectorIndexer", () => {
  beforeEach(async () => {
    // clear postgres

    const sql = postgres(postgresClientOptions);

    await sql`DROP TABLE IF EXISTS ${sql("table")} CASCADE;`;
    await sql`DROP EXTENSION IF EXISTS ${sql("vector")} CASCADE;`;

    await sql.end();
  });

  it("should be able to look up indexer", async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    const indexerParams = {
      tableName: "table",
      embeddingColumnName: "embedding",
      contentColumnName: "content",
      metadataSchema: z.object({
        film: z.string(),
      }),
    };

    const indexer = pgvectorIndexerRef(indexerParams);

    // const registryKey = "/indexer/pgvector/tableName";
    // const pluginName = parsePluginName(registryKey);

    // expect(pluginName).toBe("pgvector");

    console.log("indexer", indexer.name);

    const lookupResult = await lookupAction(`/indexer/${indexer.name}`);

    expect(lookupResult).toBeDefined();
  });

  it("should be able to index", async () => {
    const documents = [
      {
        content: [
          {
            text: "The Matrix",
          },
        ],
      },
    ];

    const indexerParams = {
      tableName: "table",
      embeddingColumnName: "embedding",
      contentColumnName: "content",
    };

    const indexer = pgvectorIndexerRef(indexerParams);

    await index({ indexer, documents });
  });

  it("should retreive docs", async () => {
    const documents = [
      {
        content: [
          {
            text: "The Matrix",
          },
        ],
      },
    ];

    const indexerParams = {
      tableName: "table",
      embeddingColumnName: "embedding",
      contentColumnName: "content",
      metadataSchema: z.object({
        film: z.string(),
      }),
    };

    const indexer = pgvectorIndexerRef(indexerParams);

    await index({ indexer, documents });

    const retrieverParams = {
      tableName: "table",
      embeddingColumnName: "embedding",
      contentColumnName: "content",
    };

    const retriever = pgVectorRetrieverRef(retrieverParams);

    const results = await retrieve({ retriever, query: "The Matrix" });

    console.log("results", results);

    const document = results[0];
    expect(document).toBeInstanceOf(Document);
    expect(document.content[0].text).toBe("The Matrix");
  });

  it("should be able to retrieve with metadata", async () => {
    const documents = [
      {
        content: [
          {
            text: "The Matrix",
          },
        ],
        metadata: {
          film: "The Matrix",
        },
      },
    ];

    const indexerParams = {
      tableName: "table",
      embeddingColumnName: "embedding",
      contentColumnName: "content",
      metadataSchema: z.object({
        film: z.string(),
      }),
    };

    const indexer = pgvectorIndexerRef(indexerParams);

    await index({ indexer, documents });

    const retrieverParams = {
      tableName: "table",
      embeddingColumnName: "embedding",
      contentColumnName: "content",
    };

    const retriever = pgVectorRetrieverRef(retrieverParams);

    const results = await retrieve({ retriever, query: "The Matrix" });

    console.log("results", results);

    const document = results[0];
    expect(document).toBeInstanceOf(Document);
    console.log("document", document);

    console.log("document.metadata", document.metadata);
  });
});
