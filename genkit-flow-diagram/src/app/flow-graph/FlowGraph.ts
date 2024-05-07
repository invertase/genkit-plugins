import { ZodGraph, ZodGraphOptions } from "./ZodGraph";
import { z } from "zod";
import { doesBasicZodSchemaExtend } from "./basicJsonSchema";

// Interfaces to define the specific flow node and edge annotations
export interface FlowNodeAnnotation {
  id: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  inputValues?: Record<string, any>;
}

export interface FlowEdgeAnnotation {
  source: string;
  target: string;
  partialInputSchema: z.ZodSchema;
  checkedKeys?: string[];
}

// Extend ZodGraph to create a more specific FlowGraph for flow-based processing
export class FlowGraph extends ZodGraph {
  constructor(args: ZodGraphOptions) {
    super(args);
  }

  // Method to add a flow node with input and output schemas
  addFlowNode(key: string, annotation: FlowNodeAnnotation): void {
    // Combine the input and output schema into a single record to fit the existing method
    const schemas: Record<string, z.ZodSchema> = {
      inputSchema: annotation.inputSchema,
      outputSchema: annotation.outputSchema,
    };
    this.addNodeWithSchemas(key, schemas);
    this.updateCompatibleInputNodes(key);
  }

  updateCompatibleInputNodes = (key: string) => {
    const node = this.getNodeSchemas(key);
    const nodeOutputSchema = node.outputSchema;
    for (const suc of this.nodes()) {
      const sucSchemas = this.getNodeSchemas(suc);
      const sucInputSchema = sucSchemas.inputSchema;
      if (doesBasicZodSchemaExtend(nodeOutputSchema, sucInputSchema)) {
        // update suc metadata with key of node
        const compatibleInputNodes = this.getNodeAttribute(
          suc,
          "compatibleInputNodes"
        );
        compatibleInputNodes.push(key);
      }
    }
  };

  // Method to retrieve the flow node annotations
  getFlowNodeAnnotation(key: string): FlowNodeAnnotation {
    const schemas = this.getNodeSchemas(key);
    return {
      id: key,
      inputSchema: schemas.inputSchema,
      outputSchema: schemas.outputSchema,
    };
  }

  // Method to add a flow edge with a partial input schema
  addFlowEdge(
    sourceKey: string,
    targetKey: string,
    annotation: FlowEdgeAnnotation
  ): void {
    const sourceNode = this.getNodeSchemas(sourceKey);
    const sourceOutputSchema = sourceNode.outputSchema;
    const partialInputSchema =
      annotation.partialInputSchema || sourceOutputSchema;

    // Use a single key to store the partial input schema in the record
    const schemas: Record<string, z.ZodSchema> = {
      partialInputSchema,
    };
    this.addEdgeWithSchemas(sourceKey, targetKey, schemas);
  }

  // Method to retrieve the flow edge annotation
  getFlowEdgeAnnotation(
    sourceKey: string,
    targetKey: string
  ): FlowEdgeAnnotation {
    const schemas = this.getEdgeSchemas(sourceKey, targetKey);
    return {
      source: sourceKey,
      target: targetKey,
      partialInputSchema: schemas.partialInputSchema,
    };
  }

  getEdgeAnnotationFromKey(key: string): FlowEdgeAnnotation {
    const [sourceKey, targetKey] = key.split("-");
    return this.getFlowEdgeAnnotation(sourceKey, targetKey);
  }
}
