import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

// Define our own interface that captures the necessary parts of a JSON Schema for our use-case.
export interface BasicJSONSchema {
  type: "object"; // Restrict to object types only.
  properties: Record<string, { type: string | "integer" }>; // Allow 'integer' as a subtype of 'number'
  required?: string[];
  additionalProperties: boolean;
  $schema?: string; // Include for completeness with JSON Schema standards.
}

export function doesBasicJSONSchemaExtend(
  schemaA: BasicJSONSchema,
  schemaB: BasicJSONSchema
): boolean {
  if (schemaA.type !== "object" || schemaB.type !== "object") {
    return false;
  }

  for (const key in schemaA.properties) {
    const propA = schemaA.properties[key];
    const propB = schemaB.properties[key];

    if (!propB) {
      return false;
    }

    // Check type compatibility, including special handling for 'number' and 'integer'.
    if (propA.type !== propB.type) {
      if (propA.type === "number" && propB.type !== "integer") {
        return false;
      }
    }
  }

  // Ensure all required properties of schemaA are also required in schemaB.
  if (schemaA.required) {
    for (const req of schemaA.required) {
      if (!schemaB.required || !schemaB.required.includes(req)) {
        return false;
      }
    }
  }

  // Check additionalProperties flag.
  if (
    schemaA.additionalProperties === false &&
    schemaB.additionalProperties !== false
  ) {
    return false;
  }

  return true;
}

// Adapter function for Zod schemas.
export const doesBasicZodSchemaExtend = (
  schemaA: z.ZodSchema,
  schemaB: z.ZodSchema
): boolean => {
  const jsonSchemaA = zodToJsonSchema(schemaA) as unknown as BasicJSONSchema;
  const jsonSchemaB = zodToJsonSchema(schemaB) as unknown as BasicJSONSchema;

  return doesBasicJSONSchemaExtend(jsonSchemaA, jsonSchemaB);
};
