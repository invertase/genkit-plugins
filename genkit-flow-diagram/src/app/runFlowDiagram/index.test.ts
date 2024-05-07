import z from "zod";
import { defineFlow, Flow } from "@genkit-ai/flow";
import { getUserDetails } from "..";
import { runFlowDiagram } from ".";
import { FlowDiagramData } from "./types";
import { configureGenkit, initializeGenkit } from "@genkit-ai/core";

initializeGenkit(
  configureGenkit({
    plugins: [],
    logLevel: "debug",
    enableTracingAndMetrics: true,
  })
);

describe("runFlowDiagram", () => {
  test("should run a simple flow diagram", async () => {
    const diagram: FlowDiagramData = {
      nodes: [
        {
          nodeId: "zh3r3k",
          flowId: "getUserDetails",
          inputValues: {
            name: "Alice",
            age: 30,
          },
        },
        {
          nodeId: "t85rehx",
          flowId: "getWelcomeMessage",
          inputValues: {},
        },
      ],
      edges: [
        {
          edgeId: "zh3r3k-t85rehx",
          source: "zh3r3k",
          target: "t85rehx",
          checkedKeys: ["userData"],
        },
      ],
    };

    const getUserDetails = defineFlow(
      {
        name: "getUserDetails",
        inputSchema: z.object({ name: z.string(), age: z.number() }),
        outputSchema: z.object({ userData: z.string() }),
      },
      async ({ name, age }) => {
        return { userData: `${name} is ${age} years old.` };
      }
    );

    const getWelcomeMessage = defineFlow(
      {
        name: "getWelcomeMessage",
        inputSchema: z.object({ userData: z.string() }),
        outputSchema: z.object({ welcomeMessage: z.string() }),
      },
      async ({ userData }) => {
        return { welcomeMessage: `Welcome, ${userData}!` };
      }
    );

    const flows: Record<string, Flow<any, any, any>> = {
      getUserDetails,
      getWelcomeMessage,
    };

    runFlowDiagram(diagram, flows);
  });
});
