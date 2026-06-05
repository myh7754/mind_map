import type { Node, Edge } from '@xyflow/react';

export interface MindNode {
  id: string;
  type: 'text' | 'table';
  label: string;
  note: string;              // BlockNote JSON string, "" if empty
  collapsed: boolean;
  tableData?: {
    headers: string[];
    rows: string[][];
  };
  style?: {
    color?: string;
  };
}

export interface MindMapData {
  id: string;
  title: string;
  rootId: string;
  children: Record<string, string[]>;  // parentId → childIds
  nodes: Record<string, MindNode>;
}

export interface PersistedState {
  mindMapData: MindMapData;
  positions: Record<string, { x: number; y: number }>;
}

export type MindMapNode = Node<MindNode>;
export type MindMapEdge = Edge<{ depth: number; preview?: boolean }>;
