import type { ZodObject, ZodRawShape, ZodTypeAny } from "zod";

export interface PostgresField {
  name: string;
  type: string;
  mode?: string;
  fields?: PostgresField[];
}

export const convert = <T extends ZodRawShape>(
  type: ZodObject<T>
): Array<PostgresField> => {
  return Object.entries(type.shape)
    .map(([name, value]) => convertAny(name, value))
    .filter(isField);
};

const isField = (field?: PostgresField): field is PostgresField => !!field;

const convertAny = (
  name: string,
  type: ZodTypeAny
): PostgresField | undefined => {
  switch (type._def.typeName) {
    case "ZodLiteral": {
      switch (typeof type._def.value) {
        case "boolean":
          return {
            name,
            type: "BOOLEAN",
          };
        case "number":
          return {
            name,
            type: "NUMERIC",
          };
        case "bigint":
          return {
            name,
            type: "BIGINT",
          };
        case "string":
          return {
            name,
            type: "TEXT",
          };
        default:
          return;
      }
    }

    case "ZodArray": {
      const child = convertAny(name, type._def.type);
      if (!child) {
        return;
      }
      return {
        ...child,
        name,
        type: `${child.type}[]`,
      };
    }

    case "ZodObject":
      return {
        name,
        type: "JSONB",
      };

    case "ZodTuple":
      return {
        name,
        type: "JSONB",
      };

    case "ZodRecord":
    case "ZodMap":
      return {
        name,
        type: "JSONB",
      };

    case "ZodSet": {
      const child = convertAny(name, type._def.valueType);
      if (!child) {
        return;
      }
      return {
        ...child,
        name,
        type: `${child.type}[]`,
      };
    }

    case "ZodBoolean":
      return {
        name,
        type: "BOOLEAN",
      };

    case "ZodNumber":
      if (
        type._def.checks.some(
          ({ kind }: { kind: string; message?: string }) => kind === "int"
        )
      ) {
        return {
          name,
          type: "INTEGER",
        };
      }
      return {
        name,
        type: "NUMERIC",
      };

    case "ZodBigInt":
      return {
        name,
        type: "BIGINT",
      };

    case "ZodNaN":
      return {
        name,
        type: "NUMERIC",
      };

    case "ZodString": {
      const checks = (
        type._def.checks as Array<{ kind: string; regex: RegExp }>
      ).filter(({ kind }: { kind: string }) => kind === "regex");
      if (checks.some(({ regex }) => regex === RegExpDate)) {
        return {
          name,
          type: "DATE",
        };
      }
      if (checks.some(({ regex }) => regex === RegExpTime)) {
        return {
          name,
          type: "TIME",
        };
      }
      return {
        name,
        type: "TEXT",
      };
    }

    case "ZodDate":
      return {
        name,
        type: "TIMESTAMP",
      };

    case "ZodEnum":
    case "ZodNativeEnum":
      return {
        name,
        type: "TEXT",
      };

    case "ZodOptional":
    case "ZodNullable": {
      const child = convertAny(name, type._def.innerType);
      if (!child) {
        return;
      }
      return {
        ...child,
        name,
      };
    }

    case "ZodDefault":
      // Ignore the type
      return convertAny(name, type._def.innerType);

    case "ZodEffects":
      // Ignore the type
      return convertAny(name, type._def.schema);

    // case "ZodUndefined":
    // case "ZodNull":
    // case "ZodUnknown":
    // case "ZodNever":
    // case "ZodVoid":
    // case "ZodFunction":
    // case "ZodPromise":
    // case "ZodLazy":
    //   // Ignore the field
    //   return;

    case "ZodUnion":
    case "ZodDiscriminatedUnion":
    case "ZodIntersection":
    case "ZodAny":
      return {
        name,
        type: "JSONB",
      };

    default:
      throw new Error(
        `The unknown type "${type._def.typeName}" is not supported in the conversion. Must be translated into the types supported by PostgreSQL before conversion. See https://www.postgresql.org/docs/current/datatype.html`
      );
  }
};

export const RegExpDate = /\d{4}-\d{2}-\d{2}/;
export const RegExpTime = /\d{2}:\d{2}:\d{2}(:?.\d{1,6})?/;
