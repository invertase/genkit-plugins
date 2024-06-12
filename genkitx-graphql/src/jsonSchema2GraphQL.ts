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
    description: "Input type for " + typeName,
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
    description: "Object type for " + typeName,
    fields: fields,
  });
}
