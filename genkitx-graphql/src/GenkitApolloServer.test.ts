import jsonSchemaToZod from "json-schema-to-zod";
import { GenkitApolloServer } from "./GenkitApolloServer";
import { getGraphqlSchemaFromJsonSchema } from "get-graphql-from-jsonschema";
describe("GenkitApolloServer", () => {
  test("getFlowsFromReflectionAPI", async () => {
    process.env.GENKIT_REFLECTION_PORT = "3100";
    process.env.GENKIT_ENV = "dev";
    const server = new GenkitApolloServer({
      port: 4003,
      cors: true,
    });

    const flows = await server.getFlowsFromReflectionAPI();

    console.log(JSON.stringify(flows, null, 2));

    const jokeFlow = flows[0][1];
    // @ts-ignore
    console.log(jokeFlow.metadata.inputSchema);
    console.log(
      // @ts-ignore
      jsonSchemaToGraphQLInput(
        // @ts-ignore
        jokeFlow.metadata.inputSchema,
        // @ts-ignore
        jokeFlow.name + "Input"
      )
    );

    console.log(
      jsonSchemaToGraphQLObject(
        // @ts-ignore
        jokeFlow.metadata.outputSchema,
        // @ts-ignore
        jokeFlow.name + "Output"
      )
    );
  });
});
import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLFloat,
  GraphQLInputObjectType,
} from "graphql";

interface JsonSchema {
  type: string;
  properties?: { [key: string]: JsonSchema };
  required?: string[];
  additionalProperties?: boolean;
}

export function jsonSchemaToGraphQLInput(
  jsonSchema: JsonSchema,
  typeName: string = "MyType"
): GraphQLInputObjectType {
  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    throw new Error("Only JSON object schemas with properties are supported");
  }

  const fields = {};
  Object.keys(jsonSchema.properties).forEach((key) => {
    const prop = jsonSchema.properties![key];
    let type: GraphQLScalarType;

    switch (prop.type) {
      case "string":
        type = GraphQLString;
        break;
      case "integer":
        type = GraphQLInt;
        break;
      case "number":
        type = GraphQLFloat; // Use GraphQLFloat for 'number' to handle floating points
        break;
      case "boolean":
        type = GraphQLBoolean;
        break;
      default:
        throw new Error(`Unsupported JSON schema type: ${prop.type}`);
    }

    if (jsonSchema.required?.includes(key)) {
      fields[key] = { type: new GraphQLNonNull(type) };
    } else {
      fields[key] = { type };
    }
  });

  return new GraphQLInputObjectType({
    name: typeName,
    fields: fields,
  });
}

export function jsonSchemaToGraphQLObject(
  jsonSchema: JsonSchema,
  typeName: string = "MyType"
): GraphQLObjectType {
  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    throw new Error("Only JSON object schemas with properties are supported");
  }

  const fields = {};
  Object.keys(jsonSchema.properties).forEach((key) => {
    const prop = jsonSchema.properties![key];
    let type: GraphQLScalarType;

    switch (prop.type) {
      case "string":
        type = GraphQLString;
        break;
      case "integer":
        type = GraphQLInt;
        break;
      case "number":
        type = GraphQLFloat; // Use GraphQLFloat for 'number' to handle floating points
        break;
      case "boolean":
        type = GraphQLBoolean;
        break;
      default:
        throw new Error(`Unsupported JSON schema type: ${prop.type}`);
    }

    if (jsonSchema.required?.includes(key)) {
      fields[key] = { type: new GraphQLNonNull(type) };
    } else {
      fields[key] = { type };
    }
  });

  return new GraphQLObjectType({
    name: typeName,
    fields: fields,
  });
}
