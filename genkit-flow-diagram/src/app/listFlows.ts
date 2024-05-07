import { Flow } from "@genkit-ai/flow";
import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";
import * as z from "zod";

type CustomFlowRepresentation = {
  name: string;
  id: string;
  inputSchema: JsonSchema7ObjectType;
  outputSchema: JsonSchema7ObjectType;
};

export const listFlows = (
  flows: Record<string, Flow>
): CustomFlowRepresentation[] => {
  const flowList = Object.values(flows);

  const flowAPIRepresentations = flowList.map((flow: Flow, i: number) => {
    if (!flow.inputSchema || !flow.outputSchema) {
      throw new Error(
        `Flow ${flow.name} is missing inputSchema or outputSchema`
      );
    }

    // TODO: can we remove casting here?
    const inputSchema = zodToJsonSchema(
      flow.inputSchema as z.ZodObject<z.ZodRawShape, z.UnknownKeysParam>
    ) as JsonSchema7ObjectType;
    const outputSchema = zodToJsonSchema(
      flow.outputSchema as z.ZodObject<z.ZodRawShape, z.UnknownKeysParam>
    ) as JsonSchema7ObjectType;

    return {
      name: flow.name,
      id: i.toString(),
      inputSchema,
      outputSchema,
    };
  });
  return flowAPIRepresentations;
};
