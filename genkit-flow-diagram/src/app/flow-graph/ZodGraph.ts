import * as graphology from "graphology";
import { z } from "zod";

export type ZodGraphOptions = {
  allowSelfLoops?: boolean;
  multi?: boolean;
};

export class ZodGraph extends graphology.MultiDirectedGraph {
  constructor(args: ZodGraphOptions) {
    super({ ...args, type: "directed" });
  }

  /**
   * Add a node with a set of Zod schemas.
   * @param {string} key - The node identifier.
   * @param {Record<string, z.ZodSchema>} schemas - The record of Zod schemas to be stored.
   */
  addNodeWithSchemas(
    key: string,
    schemas: Record<string, z.ZodSchema>,
    metadata?: Record<string, string | string[]>
  ): void {
    // Ensure the node does not already exist
    if (this.hasNode(key)) {
      throw new Error(`Node with key '${key}' already exists.`);
    }
    // Add the node with the Zod schemas as an attribute
    this.addNode(key, { schemas, ...metadata });
  }

  /**
   * Retrieve the Zod schemas of a node.
   * @param {string} key - The node identifier.
   * @return {Record<string, z.ZodSchema>} The record of Zod schemas associated with the node.
   */
  getNodeSchemas(key: string): Record<string, z.ZodSchema> {
    if (!this.hasNode(key)) {
      throw new Error(`Node with key '${key}' does not exist.`);
    }
    return this.getNodeAttribute(key, "schemas");
  }

  /**
   * Add an edge between two nodes and associate it with a set of Zod schemas.
   * @param {string} sourceKey - The source node identifier.
   * @param {string} targetKey - The target node identifier.
   * @param {Record<string, z.ZodSchema>} schemas - The record of Zod schemas to be stored as labels.
   */
  addEdgeWithSchemas(
    sourceKey: string,
    targetKey: string,
    schemas: Record<string, z.ZodSchema>
  ): void {
    // Ensure both nodes exist
    if (!this.hasNode(sourceKey) || !this.hasNode(targetKey)) {
      throw new Error(
        `One or both nodes '${sourceKey}' or '${targetKey}' do not exist.`
      );
    }
    // Add the edge with the Zod schemas as an attribute
    this.addEdgeWithKey(`${sourceKey}-${targetKey}`, sourceKey, targetKey, {
      schemas,
    });
  }

  /**
   * Retrieve the Zod schemas of an edge.
   * @param {string} sourceKey - The source node identifier.
   * @param {string} targetKey - The target node identifier.
   * @return {Record<string, z.ZodSchema>} The record of Zod schemas associated with the edge.
   */
  getEdgeSchemas(
    sourceKey: string,
    targetKey: string
  ): Record<string, z.ZodSchema> {
    const edgeKey = `${sourceKey}-${targetKey}`;
    if (!this.hasEdge(edgeKey)) {
      throw new Error(
        `Edge from '${sourceKey}' to '${targetKey}' does not exist.`
      );
    }
    return this.getEdgeAttribute(edgeKey, "schemas");
  }
}
