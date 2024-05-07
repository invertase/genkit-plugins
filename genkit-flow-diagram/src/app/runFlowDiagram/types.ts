export interface NodeData {
  nodeId: string;
  flowId: string;
  inputValues: Record<string, string | number>;
}

export interface EdgeData {
  edgeId: string;
  source: string;
  target: string;
  checkedKeys: string[];
}

export interface FlowDiagramData {
  nodes: NodeData[];
  edges: EdgeData[];
}
