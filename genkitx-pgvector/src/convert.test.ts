import { ZodObject, ZodRawShape, z } from "zod";
import { convert, PostgresField } from "./convert";

describe("convert", () => {
  test("converts ZodObject with various types correctly", () => {
    const schema = z.object({
      id: z.string(),
      age: z.number().int(),
      isAdmin: z.boolean(),
      createdAt: z.date(),
      tags: z.array(z.string()),
    });

    const expected: PostgresField[] = [
      { name: "id", type: "TEXT" },
      { name: "age", type: "INTEGER" },
      { name: "isAdmin", type: "BOOLEAN" },
      { name: "createdAt", type: "TIMESTAMP" },
      { name: "tags", type: "TEXT[]" },
    ];

    expect(convert(schema)).toEqual(expected);
  });

  test("handles nested ZodObject types correctly", () => {
    const nestedSchema = z.object({
      user: z.object({
        id: z.string(),
        name: z.string(),
      }),
    });

    const expected: PostgresField[] = [{ name: "user", type: "JSONB" }];

    expect(convert(nestedSchema)).toEqual(expected);
  });

  test("handles optional and nullable fields correctly", () => {
    const schema = z.object({
      name: z.string().optional(),
      description: z.string().nullable(),
    });

    const expected: PostgresField[] = [
      { name: "name", type: "TEXT" },
      { name: "description", type: "TEXT" },
    ];

    expect(convert(schema)).toEqual(expected);
  });

  test("handles enum and native enum types correctly", () => {
    const schema = z.object({
      status: z.enum(["active", "inactive"]),
      role: z.nativeEnum({ Admin: "Admin", User: "User" }),
    });

    const expected: PostgresField[] = [
      { name: "status", type: "TEXT" },
      { name: "role", type: "TEXT" },
    ];

    expect(convert(schema)).toEqual(expected);
  });

  test("throws an error for unsupported types", () => {
    const schema = z.object({
      unsupported: z.function(z.tuple([]), z.void()),
    });
    try {
      convert(schema);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }

    expect(() => convert(schema)).toThrow(
      'The unknown type "ZodFunction" is not supported in the conversion.'
    );
  });
});
