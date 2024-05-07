import { gql, ApolloServer } from "apollo-server";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { Flow } from "@genkit-ai/flow";
import { getGraphqlSchemaFromJsonSchema } from "get-graphql-from-jsonschema";
import { jsonSchemaToZod } from "json-schema-to-zod";
import { zodToGraphQL } from "./zod2GraphQL";
import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLFloat,
  GraphQLInputObjectType,
} from "graphql";
import {
  jsonSchemaToGraphQLInput,
  jsonSchemaToGraphQLObject,
} from "./jsonSchema2GraphQL";
interface GenkitApolloServerParams {
  port: number;
  cors: boolean;
}

export class GenkitApolloServer {
  private server?: ApolloServer;
  private resolvers: any = {};
  private typeDefs: any[] = [];

  constructor(private params: GenkitApolloServerParams) {}

  private async initServer() {
    const flows = await this.getFlowsFromReflectionAPI();
    const schema = this.getSchema(flows);
    this.server = new ApolloServer({
      schema,
      plugins: [ApolloServerPluginLandingPageGraphQLPlayground()],
    });
  }

  async getFlowsFromReflectionAPI() {
    if (
      process.env.GENKIT_ENV !== "dev" ||
      process.env.GENKIT_REFLECTION_PORT === undefined
    ) {
      throw new Error("Reflection API is not available");
    }
    console.log("Fetching flows from reflection API");che
    const response = await fetch(
      `http://localhost:${process.env.GENKIT_REFLECTION_PORT}/api/actions`
    );
    const flows = Object.entries(await response.json()).filter(
      ([key, action]) => key.startsWith("/flow")
    );
    return flows;
  }

  getSchema(flows: [string, any][]) {
    let types: string[] = [];
    let resolvers: any = {};

    const fields = {};

    flows.forEach(([path, flow]) => {
      const { metadata } = flow;
      if (!metadata.inputSchema || !metadata.outputSchema) {
        return;
      }

      const inputType = jsonSchemaToGraphQLInput(
        metadata.inputSchema,
        flow.name + "Input"
      );

      const outputType = jsonSchemaToGraphQLObject(
        metadata.outputSchema,
        flow.name + "Output"
      );

      resolvers = {
        Query: {
          ...resolvers.Query,
          [`run${flow.name}`]: async (
            _source: any,
            args: any,
            _context: any,
            _info: any
          ) => {
            console.log("Running flow", flow.name, args);
            return {}; // Placeholder
          },
        },
      };

      fields[flow.name] = {
        type: outputType,
        args: {
          input: { type: inputType },
        },
        resolve: async (parent, args, context, info) => {
          console.log("Running flow", flow.name, args);
          console.log(parent, args, context, info);

          const body = {
            key: path,
            input: {
              start: {
                input: args.input,
              },
            },
          };

          console.log("Body", body);

          const result = await fetch(
            `http://localhost:${process.env.GENKIT_REFLECTION_PORT}/api/runAction?batch=1`,
            {
              method: "POST",
              body: JSON.stringify(body),
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const resultBody = await result.json();
          //   @ts-ignore
          return resultBody.result.operation.result.response;
        },
      };
    });

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: "Query",
        fields,
      }),
    });

    return schema;
  }

  async start() {
    console.log("Starting Apollo Server");
    const { port, cors } = this.params;
    await this.initServer();
    if (!this.server) {
      throw new Error("Server not initialized");
    }

    this.server.listen({ port, cors });
    console.log(`🚀 Server ready at http://localhost:${port}`);
  }
}
