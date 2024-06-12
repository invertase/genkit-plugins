import z from "zod";

class FlowManager {
  private reflectionAPIBaseURL: string;

  constructor({ genkitReflectionPort, genkitEnv }) {
    if (!genkitReflectionPort || genkitEnv !== "dev") {
      throw new Error("Reflection API port must be provided");
    }
    this.reflectionAPIBaseURL = `http://localhost:${genkitReflectionPort}/api`;
  }

  // Method to list all available flows with their input and output schemas
  async listFlows() {
    let response: Response;
    try {
      response = await fetch(`${this.reflectionAPIBaseURL}/actions`);
    } catch (e) {
      throw new Error("Reflection API Actions Endpoint is not available");
    }
    return this.parseFlows(response);
  }

  private async parseFlows(response: Response) {
    const flowSchema = z
      .record(
        z.object({
          metadata: z.object({
            inputSchema: z
              .object({
                type: z.literal("object"),
              })
              .passthrough(),
            outputSchema: z
              .object({
                type: z.literal("object"),
              })
              .passthrough(),
          }),
        })
      )
      .transform((flows) => {
        return Object.entries(flows).map(([key, action]) => ({
          name: key.replace("/flow/", ""),
          inputSchema: action.metadata.inputSchema,
          outputSchema: action.metadata.outputSchema,
        }));
      });

    try {
      const result = await response.json();

      const flows = Object.keys(result).filter((key) =>
        key.startsWith("/flow/")
      );

      const parsedFlows = flowSchema.parse(flows);
      return parsedFlows;
    } catch (e) {
      console.log(e);
      throw new Error(
        "Unable to parse Reflection API Actions Endpoint response"
      );
    }
  }

  // Method to run a specific flow with the given input
  async runFlow(flowName: string, input: Record<string, any>) {
    const body = {
      key: `/flow/${flowName}`,
      input: {
        start: {
          input: input,
        },
      },
    };

    const response = await fetch(
      `${this.reflectionAPIBaseURL}/runAction?batch=1`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const res = await response.json();

    const flowResponseSchema = z
      .object({
        operation: z.object({
          result: z.object({
            response: z.unknown(),
          }),
        }),
      })
      .transform((result) => result.operation.result.response);

    try {
      return flowResponseSchema.parse(res);
    } catch (e) {
      console.error(e);
      throw new Error("Unable to parse Flow response");
    }
  }
}

export default FlowManager;
