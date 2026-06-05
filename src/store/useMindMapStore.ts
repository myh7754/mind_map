import { create } from 'zustand';
import { temporal } from 'zundo';
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { MindNode, MindMapData, MindMapNode, MindMapEdge } from '../types';
import { applyDagreLayout } from '../utils/layout';
import { nanoid } from 'nanoid';

// ─── 초기 데이터 ──────────────────────────────────────────────
const ROOT_ID = 'root';
const CHILD_ID = 'child-1';

const initialMindMapData: MindMapData = {
  id: 'default',
  title: '새 마인드맵',
  rootId: ROOT_ID,
  children: {
    [ROOT_ID]: [CHILD_ID],
    [CHILD_ID]: [],
  },
  nodes: {
    [ROOT_ID]: { id: ROOT_ID, type: 'text', label: '중심 주제', note: '', collapsed: false },
    [CHILD_ID]: { id: CHILD_ID, type: 'text', label: '키워드 1', note: '', collapsed: false },
  },
};

// ─── 헬퍼 함수 ────────────────────────────────────────────────
function getNodeDepth(nodeId: string, children: Record<string, string[]>, rootId: string): number {
  const queue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (id === nodeId) return depth;
    for (const childId of children[id] ?? []) {
      queue.push({ id: childId, depth: depth + 1 });
    }
  }
  return 0;
}

function getHiddenIds(
  rootId: string,
  children: Record<string, string[]>,
  nodes: Record<string, MindNode>
): Set<string> {
  const hidden = new Set<string>();
  function traverse(id: string) {
    for (const childId of children[id] ?? []) {
      hidden.add(childId);
      traverse(childId);
    }
  }
  function check(id: string) {
    if (nodes[id]?.collapsed) {
      traverse(id);
    } else {
      for (const childId of children[id] ?? []) {
        check(childId);
      }
    }
  }
  check(rootId);
  return hidden;
}

// nodeId의 후손(자기 자신 포함) 집합. 순환 방지 검증에 사용.
function collectSubtree(nodeId: string, children: Record<string, string[]>): Set<string> {
  const set = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    set.add(cur);
    for (const c of children[cur] ?? []) queue.push(c);
  }
  return set;
}

// nodeId의 현재 부모를 찾는다. 없으면 null(루트).
function findParent(nodeId: string, children: Record<string, string[]>): string | null {
  for (const [parentId, kids] of Object.entries(children)) {
    if (kids.includes(nodeId)) return parentId;
  }
  return null;
}

function buildReactFlow(
  mindMapData: MindMapData,
  positions: Record<string, { x: number; y: number }>
): { rfNodes: MindMapNode[]; rfEdges: MindMapEdge[] } {
  const { nodes, children, rootId } = mindMapData;
  const hiddenIds = getHiddenIds(rootId, children, nodes);

  // 노드를 트리 DFS(=children 배열) 순서로 나열한다.
  // dagre는 노드를 추가한 순서로 같은 rank의 세로 순서를 정하므로,
  // 이렇게 해야 형제 순서(children 배열 순서)가 화면 위→아래와 일치한다.
  const orderedNodes: MindNode[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    const n = nodes[id];
    if (!n || seen.has(id)) return;
    seen.add(id);
    orderedNodes.push(n);
    for (const childId of children[id] ?? []) visit(childId);
  };
  visit(rootId);
  // 트리에 안 걸린 고아 노드도 빠짐없이 포함 (안전망)
  for (const n of Object.values(nodes)) if (!seen.has(n.id)) orderedNodes.push(n);

  const rfNodes: MindMapNode[] = orderedNodes.map((node) => ({
    id: node.id,
    type: node.type === 'table' ? 'tableNode' : 'textNode',
    position: positions[node.id] ?? { x: 0, y: 0 },
    data: node,
    hidden: hiddenIds.has(node.id),
  }));

  const rfEdges: MindMapEdge[] = [];
  for (const [parentId, childIds] of Object.entries(children)) {
    for (const childId of childIds) {
      const depth = getNodeDepth(parentId, children, rootId);
      rfEdges.push({
        id: `${parentId}-${childId}`,
        source: parentId,
        target: childId,
        type: 'bezierEdge',
        data: { depth },
        hidden: hiddenIds.has(childId),
      });
    }
  }

  return { rfNodes, rfEdges };
}

// ─── 스토어 타입 ──────────────────────────────────────────────
interface MindMapStoreState {
  mindMapData: MindMapData;
  rfNodes: MindMapNode[];
  rfEdges: MindMapEdge[];
  positions: Record<string, { x: number; y: number }>;
  selectedNodeId: string | null;
  isNoteDrawerOpen: boolean;
  noteDrawerWidth: number;
}

interface MindMapStoreActions {
  addChildNode: (parentId: string, type?: 'text' | 'table') => void;
  updateNodeLabel: (id: string, label: string) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;
  reparentNode: (nodeId: string, newParentId: string) => void;
  moveNode: (nodeId: string, newParentId: string, index: number) => void;
  toggleCollapse: (id: string) => void;
  updateNodeNote: (id: string, note: string) => void;
  updateNodeTableData: (id: string, tableData: NonNullable<MindNode['tableData']>) => void;
  setSelectedNodeId: (id: string | null) => void;
  openNoteDrawer: (nodeId: string) => void;
  closeNoteDrawer: () => void;
  setNoteDrawerWidth: (width: number) => void;
  onRfNodesChange: (changes: NodeChange[]) => void;
  onRfEdgesChange: (changes: EdgeChange[]) => void;
  applyLayout: () => void;
  loadFromPersisted: (mindMapData: MindMapData, positions: Record<string, { x: number; y: number }>) => void;
  syncRfFromData: () => void;
}

type MindMapStore = MindMapStoreState & MindMapStoreActions;

const { rfNodes: _initNodes, rfEdges: initialRfEdges } = buildReactFlow(initialMindMapData, {});
const initialRfNodes = applyDagreLayout(_initNodes, initialRfEdges);

// ─── 스토어 ───────────────────────────────────────────────────
export const useMindMapStore = create<MindMapStore>()(
  temporal(
    (set, get) => ({
      mindMapData: initialMindMapData,
      rfNodes: initialRfNodes,
      rfEdges: initialRfEdges,
      positions: {},
      selectedNodeId: null,
      isNoteDrawerOpen: false,
      noteDrawerWidth: 360,

      addChildNode: (parentId, type = 'text') => {
        const { mindMapData, positions } = get();
        const newId = nanoid(8);
        const newNode: MindNode = { id: newId, type, label: '새 노드', note: '', collapsed: false };
        const newData: MindMapData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [newId]: newNode },
          children: {
            ...mindMapData.children,
            [parentId]: [...(mindMapData.children[parentId] ?? []), newId],
            [newId]: [],
          },
        };
        const { rfNodes, rfEdges } = buildReactFlow(newData, positions);
        const laidOut = applyDagreLayout(rfNodes, rfEdges);
        const newPositions = Object.fromEntries(laidOut.map((n) => [n.id, n.position]));
        set({ mindMapData: newData, rfNodes: laidOut, rfEdges, positions: newPositions });
      },

      updateNodeLabel: (id, label) => {
        const { mindMapData, positions } = get();
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...mindMapData.nodes[id], label } },
        };
        const { rfNodes, rfEdges } = buildReactFlow(newData, positions);
        set({ mindMapData: newData, rfNodes, rfEdges });
      },

      // 끝에 붙이는 단순 재배치 (moveNode의 append 형태)
      reparentNode: (nodeId, newParentId) =>
        get().moveNode(nodeId, newParentId, Number.MAX_SAFE_INTEGER),

      // nodeId를 newParentId의 children 중 index 위치로 이동.
      // 같은 부모 안에서도 동작하므로 형제 순서 변경(reorder)에 쓰인다.
      moveNode: (nodeId, newParentId, index) => {
        const { mindMapData, positions } = get();
        const { rootId, children } = mindMapData;

        // 검증: 루트는 이동 불가 / 자기 자신에 붙일 수 없음
        if (nodeId === rootId || nodeId === newParentId) return;
        // 검증: 새 부모가 노드 자신의 후손이면 순환이 생기므로 금지
        const subtree = collectSubtree(nodeId, children);
        if (subtree.has(newParentId)) return;

        const currentParent = findParent(nodeId, children);

        const newChildren: Record<string, string[]> = { ...children };
        // 기존 부모에서 제거
        if (currentParent) {
          newChildren[currentParent] = (newChildren[currentParent] ?? []).filter(
            (c) => c !== nodeId
          );
        }
        // 새 부모 배열에서도 (혹시 모를 중복 대비) 제거 후 index 위치에 삽입
        const target = (newChildren[newParentId] ?? []).filter((c) => c !== nodeId);
        const clamped = Math.max(0, Math.min(index, target.length));
        target.splice(clamped, 0, nodeId);
        newChildren[newParentId] = target;

        // 변화 없음(같은 부모 + 같은 순서)이면 히스토리 노이즈 방지를 위해 종료
        const prev = children[newParentId] ?? [];
        if (
          currentParent === newParentId &&
          prev.length === target.length &&
          prev.every((id, i) => id === target[i])
        ) {
          return;
        }

        const newData = { ...mindMapData, children: newChildren };
        const { rfNodes, rfEdges } = buildReactFlow(newData, positions);
        const laidOut = applyDagreLayout(rfNodes, rfEdges);
        const newPositions = Object.fromEntries(laidOut.map((n) => [n.id, n.position]));
        set({ mindMapData: newData, rfNodes: laidOut, rfEdges, positions: newPositions });
      },

      deleteNode: (id) => get().deleteNodes([id]),

      deleteNodes: (ids) => {
        const { mindMapData, positions } = get();
        // 삭제 대상 + 모든 후손 수집 (루트는 제외)
        const toDelete = new Set<string>();
        for (const id of ids) {
          if (id === mindMapData.rootId) continue;
          if (toDelete.has(id)) continue;
          const queue = [id];
          while (queue.length > 0) {
            const cur = queue.shift()!;
            toDelete.add(cur);
            for (const childId of mindMapData.children[cur] ?? []) {
              if (!toDelete.has(childId)) queue.push(childId);
            }
          }
        }
        if (toDelete.size === 0) return;
        const newNodes = Object.fromEntries(
          Object.entries(mindMapData.nodes).filter(([k]) => !toDelete.has(k))
        );
        const newChildren = Object.fromEntries(
          Object.entries(mindMapData.children)
            .filter(([k]) => !toDelete.has(k))
            .map(([k, v]) => [k, v.filter((c) => !toDelete.has(c))])
        );
        const newData = { ...mindMapData, nodes: newNodes, children: newChildren };
        const { rfNodes, rfEdges } = buildReactFlow(newData, positions);
        const laidOut = applyDagreLayout(rfNodes, rfEdges);
        const newPositions = Object.fromEntries(laidOut.map((n) => [n.id, n.position]));
        set({
          mindMapData: newData,
          rfNodes: laidOut,
          rfEdges,
          positions: newPositions,
          selectedNodeId: null,
          isNoteDrawerOpen: false,
        });
      },

      toggleCollapse: (id) => {
        const { mindMapData, positions } = get();
        const node = mindMapData.nodes[id];
        if (!node) return;
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...node, collapsed: !node.collapsed } },
        };
        const { rfNodes, rfEdges } = buildReactFlow(newData, positions);
        set({ mindMapData: newData, rfNodes, rfEdges });
      },

      updateNodeNote: (id, note) => {
        const { mindMapData, positions } = get();
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...mindMapData.nodes[id], note } },
        };
        const { rfNodes, rfEdges } = buildReactFlow(newData, positions);
        set({ mindMapData: newData, rfNodes, rfEdges });
      },

      updateNodeTableData: (id, tableData) => {
        const { mindMapData, positions } = get();
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...mindMapData.nodes[id], tableData } },
        };
        const { rfNodes, rfEdges } = buildReactFlow(newData, positions);
        set({ mindMapData: newData, rfNodes, rfEdges });
      },

      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      openNoteDrawer: (nodeId) => set({ selectedNodeId: nodeId, isNoteDrawerOpen: true }),

      closeNoteDrawer: () => set({ isNoteDrawerOpen: false }),

      setNoteDrawerWidth: (width) => {
        const clamped = Math.max(280, Math.min(width, window.innerWidth * 0.75));
        localStorage.setItem('note-panel-width', String(clamped));
        set({ noteDrawerWidth: clamped });
      },

      onRfNodesChange: (changes) => {
        // 노드 드래그가 비활성(nodesDraggable=false)이라 위치는 안 바뀐다.
        // 선택/치수 변경 등 시각 상태만 rfNodes에 반영하고, positions는 건드리지 않는다.
        // (positions를 매번 새로 만들면 undo 히스토리에 노이즈가 쌓인다)
        set((state) => ({
          rfNodes: applyNodeChanges(changes, state.rfNodes) as MindMapNode[],
        }));
      },

      onRfEdgesChange: (changes) => {
        set((state) => ({
          rfEdges: applyEdgeChanges(changes, state.rfEdges) as MindMapEdge[],
        }));
      },

      applyLayout: () => {
        const { rfNodes, rfEdges } = get();
        const laidOut = applyDagreLayout(rfNodes, rfEdges);
        const newPositions = Object.fromEntries(laidOut.map((n) => [n.id, n.position]));
        set({ rfNodes: laidOut, positions: newPositions });
      },

      loadFromPersisted: (mindMapData, positions) => {
        const { rfNodes, rfEdges } = buildReactFlow(mindMapData, positions);
        set({ mindMapData, rfNodes, rfEdges, positions });
      },

      // undo/redo는 mindMapData/positions만 복원하므로, 파생 상태인
      // rfNodes/rfEdges를 다시 만들어줘야 캔버스에 반영된다.
      syncRfFromData: () => {
        const { mindMapData, positions } = get();
        const { rfNodes, rfEdges } = buildReactFlow(mindMapData, positions);
        set({ rfNodes, rfEdges });
      },
    }),
    {
      partialize: (state) => ({
        mindMapData: state.mindMapData,
        positions: state.positions,
      }),
      // mindMapData/positions 참조가 실제로 바뀐 set만 히스토리에 기록한다.
      // (선택·노트열기 등 데이터와 무관한 set은 기록하지 않음)
      equality: (a, b) =>
        a.mindMapData === b.mindMapData && a.positions === b.positions,
    }
  )
);

export const useUndoRedo = () => {
  const { undo, redo, pastStates, futureStates } = useMindMapStore.temporal.getState();
  return {
    // undo/redo 직후 파생 상태(rfNodes/rfEdges)를 재생성해 캔버스에 반영
    undo: () => {
      undo();
      useMindMapStore.getState().syncRfFromData();
    },
    redo: () => {
      redo();
      useMindMapStore.getState().syncRfFromData();
    },
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
  };
};
