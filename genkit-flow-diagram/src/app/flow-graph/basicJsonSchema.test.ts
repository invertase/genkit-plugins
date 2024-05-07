import { doesBasicJSONSchemaExtend, BasicJSONSchema } from "./basicJsonSchema";

describe("JSON Schema Extension Tests", () => {
  const schemaBase: BasicJSONSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
    additionalProperties: false,
  };

  test("Schema B extends Schema A with exact same schema", () => {
    const schemaB: BasicJSONSchema = {
      ...schemaBase,
    };
    expect(doesBasicJSONSchemaExtend(schemaBase, schemaB)).toBe(true);
  });

  test("Schema B extends Schema A with compatible type (number -> integer)", () => {
    const schemaB: BasicJSONSchema = {
      ...schemaBase,
      properties: {
        ...schemaBase.properties,
        age: { type: "integer" },
      },
    };
    expect(doesBasicJSONSchemaExtend(schemaBase, schemaB)).toBe(true);
  });

  test("Schema B does not extend Schema A (missing required property)", () => {
    const schemaB: BasicJSONSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    };
    expect(doesBasicJSONSchemaExtend(schemaBase, schemaB)).toBe(false);
  });

  test("Schema B does not extend Schema A (incompatible types)", () => {
    const schemaB: BasicJSONSchema = {
      ...schemaBase,
      properties: {
        ...schemaBase.properties,
        age: { type: "string" }, // Incompatible type change
      },
    };
    expect(doesBasicJSONSchemaExtend(schemaBase, schemaB)).toBe(false);
  });

  test("Schema B extends Schema A with additional required property", () => {
    const schemaB: BasicJSONSchema = {
      ...schemaBase,
      required: ["name", "age", "email"], // Adding non-existing required property
      properties: {
        ...schemaBase.properties,
        email: { type: "string" },
      },
    };
    expect(doesBasicJSONSchemaExtend(schemaBase, schemaB)).toBe(true);
  });

  test("Schema B does not extend Schema A (allows additional properties when A does not)", () => {
    const schemaB: BasicJSONSchema = {
      ...schemaBase,
      additionalProperties: true, // Schema A disallows additional properties
    };
    expect(doesBasicJSONSchemaExtend(schemaBase, schemaB)).toBe(false);
  });

  test("Schema B does not extend Schema A (mismatch in additional properties settings)", () => {
    const schemaB: BasicJSONSchema = {
      ...schemaBase,
      additionalProperties: true, // More permissive than Schema A
    };
    expect(doesBasicJSONSchemaExtend(schemaBase, schemaB)).toBe(false);
  });
});
