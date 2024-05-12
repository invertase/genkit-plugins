import z from "zod";

class FlowManager {
  private reflectionAPIBaseURL: string;
  private parsedFlows?: any[];

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
          metadata: z
            .object({
              inputSchema: z
                .object({
                  type: z.literal("object"),
                  properties: z.record(
                    z.object({ type: z.string() }).passthrough()
                  ),
                })
                .passthrough(),
              outputSchema: z
                .object({
                  type: z.literal("object"),
                  properties: z.record(
                    z.object({ type: z.string() }).passthrough()
                  ),
                })
                .passthrough(),
            })
            .passthrough(),
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

      const flows = Object.fromEntries(
        Object.entries(result).filter(([key]) => key.startsWith("/flow/"))
      );
      const parsedFlows = flowSchema.parse(flows);

      // // Extract all keys and their types, along with the flow names they belong to
      // const allFlowInputKeys = parsedFlows.flatMap((flow) =>
      //   Object.entries(flow.inputSchema.properties).map(([key, value]) => ({
      //     flowName: flow.name,
      //     key,
      //     value,
      //   }))
      // );

      // const allFlowOutputKeys = parsedFlows.flatMap((flow) =>
      //   Object.entries(flow.outputSchema.properties).map(([key, value]) => ({
      //     flowName: flow.name,
      //     key,
      //     value,
      //   }))
      // );

      // // Creating transformer flows
      // for (const input of allFlowInputKeys) {
      //   for (const output of allFlowOutputKeys) {
      //     if (
      //       input.value.type === output.value.type &&
      //       input.key !== output.key &&
      //       input.flowName !== output.flowName
      //     ) {
      //       parsedFlows.push({
      //         name: `__transformer/${output.flowName}_to_${input.flowName}/${output.key}_to_${input.key}`,
      //         inputSchema: {
      //           type: "object",
      //           properties: {
      //             [output.key]: output.value,
      //           },
      //         },
      //         outputSchema: {
      //           type: "object",
      //           properties: {
      //             [input.key]: input.value,
      //           },
      //         },
      //       });
      //     }
      //   }
      // }
      this.parsedFlows = parsedFlows;
      return parsedFlows;
    } catch (e) {
      console.log(e);
      throw new Error(
        "Unable to parse Reflection API Actions Endpoint response"
      );
    }
  }

  // Method to run a specific flow with the given input
  async runFlow(
    flowName: string,
    input: Record<string, any>
  ): Promise<Record<string, any>> {
    // if (flowName.startsWith("__transformer/") ) {
    //   if (!this.parsedFlows) {
    //     await this.listFlows();
    //   }
    //   const transformerFlow = this.parsedFlows!.find(
    //     (flow) => flow.name === flowName
    //   );

    //   if (!transformerFlow) {
    //     throw new Error("Transformer Flow not found");
    //   }

    //   const outputKey = Object.keys(transformerFlow.outputSchema.properties)[0];

    //   return {
    //     [outputKey]: input[Object.keys(input)[0]],
    //   };
    // }

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
      return flowResponseSchema.parse(res.result) as Record<string, any>;
    } catch (e) {
      console.error(e);
      throw new Error(
        "Unable to parse Flow response + \n\n" + JSON.stringify(res.result)
      );
    }
  }
}

export default FlowManager;
