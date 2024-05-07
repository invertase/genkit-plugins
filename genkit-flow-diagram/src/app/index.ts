import express, { Request, Response } from "express";
import cors from "cors";
import { runFlowDiagram } from "./runFlowDiagram";
import FlowManager from "../FlowManager";

export const getApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/listFlows", async (req: Request, res: Response) => {
    const flowManager = new FlowManager({
      genkitReflectionPort: process.env.GENKIT_REFLECTION_PORT,
      genkitEnv: process.env.GENKIT_ENV,
    });

    const flows = await flowManager.listFlows();
    res.status(200);
    res.send(flows);
  });

  app.post("/runFlowDiagram", async (req: Request, res: Response) => {
    const graph = await runFlowDiagram(req.body);
    const nodeAnnotations = graph.nodes().map((node) => {
      return {
        node,
        attributes: graph.getNodeAttributes(node),
      };
    });

    res.status(200);
    res.send(nodeAnnotations);
  });

  return app;
};
