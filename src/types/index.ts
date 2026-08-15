import type { Node, Edge } from '@xyflow/react';

/**
 * xyflow v12는 Node<T>/Edge<T>의 T에 Record<string, unknown> 제약을 건다
 * (내부에서 data를 키로 순회하기 때문). 인덱스 시그니처가 없는 일반 interface는
 * 이 제약을 통과하지 못하므로 Record를 extends해 시그니처를 부여한다.
 */
export interface MindNode extends Record<string, unknown> {
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

export interface MindEdgeData extends Record<string, unknown> {
  depth: number;
  preview?: boolean;
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
  // 저장 시각. 다른 탭이 더 나중에 저장했는지 판단하는 데 쓴다.
  // 이 필드가 생기기 전에 저장된 레코드에는 없으므로 optional.
  updatedAt?: number;
}

/** 자동 저장 상태. 실패를 사용자에게 보여주기 위한 것. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 맵 목록에 쓰는 요약 정보. 전체 내용을 읽지 않고 고를 수 있게 한다. */
export interface MapSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export type MindMapNode = Node<MindNode>;
export type MindMapEdge = Edge<MindEdgeData>;
