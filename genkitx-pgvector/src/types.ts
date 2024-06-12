import { EmbedderArgument } from "@genkit-ai/ai/embedder";
import { z } from "zod";

export interface PgVectorPluginParams<
  EmbedderCustomOptions extends z.ZodTypeAny,
> {
  tableName: string;
  embeddingColumnName: string;
  contentColumnName: string;
  embedder: EmbedderArgument<EmbedderCustomOptions>;
  embedderOptions: z.infer<EmbedderCustomOptions>;
  metadataSchema?: z.ZodObject<any>;
  createTableIfMissing?: boolean;
  displayName?: string;
  postgresClientOptions: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  };
}
