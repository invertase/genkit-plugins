import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
} from "graphql";
import z from "zod";

export function zodToGraphQL(zodSchema: z.AnyZodObject | undefined) {
  if (!zodSchema) {
    throw new Error("Zod schema is required");
  }
  const fields = {};
  Object.keys(zodSchema.shape).forEach((key) => {
    const field = zodSchema.shape[key];
    if (field instanceof z.ZodString) {
      fields[key] = { type: GraphQLString };
    } else if (field instanceof z.ZodNumber) {
      fields[key] = { type: GraphQLInt };
    } else if (field instanceof z.ZodBoolean) {
      fields[key] = { type: GraphQLBoolean };
    }
    // Add other Zod types as needed
  });
  return new GraphQLObjectType({
    name: "MyType", // You might want to make this dynamic
    fields: fields,
  });
}
