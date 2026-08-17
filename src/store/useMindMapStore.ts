import { create } from 'zustand';
import { temporal } from 'zundo';
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { MindNode, MindMapData, MindMapNode, MindMapEdge, SaveStatus } from '../types';
import { applyTreeLayout } from '../utils/layout';
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

type Positions = Record<string, { x: number; y: number }>;

/**
 * 빈 마인드맵 하나를 만든다. 과목별로 맵을 나눠 쓰는 흐름의 시작점.
 *
 * id는 nanoid로 뽑는다 — 'default' 같은 슬롯 이름이 아니라 전역 고유값이어야
 * 나중에 여러 사용자의 맵이 한 저장소에 섞여도 그대로 쓸 수 있다.
 */
export function createEmptyMindMap(title: string): MindMapData {
  const rootId = nanoid(8);
  return {
    id: nanoid(10),
    title,
    rootId,
    children: { [rootId]: [] },
    nodes: {
      [rootId]: { id: rootId, type: 'text', label: title, note: '', collapsed: false },
    },
  };
}

// ─── 헬퍼 함수 ────────────────────────────────────────────────

/**
 * 트리를 한 번만 순회해 depth/parent를 동시에 구한다.
 * (예전에는 간선마다 루트에서 BFS를 다시 돌려 O(N²)였다)
 */
interface TreeIndex {
  depth: Map<string, number>;
  parent: Map<string, string>;
}

function buildTreeIndex(rootId: string, children: Record<string, string[]>): TreeIndex {
  const depth = new Map<string, number>([[rootId, 0]]);
  const parent = new Map<string, string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const d = depth.get(id)!;
    for (const childId of children[id] ?? []) {
      if (depth.has(childId)) continue; // 중복/순환 방어
      depth.set(childId, d + 1);
      parent.set(childId, id);
      stack.push(childId);
    }
  }
  return { depth, parent };
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
  positions: Positions,
  selectedNodeId: string | null = null,
  prevNodes: MindMapNode[] = []
): { rfNodes: MindMapNode[]; rfEdges: MindMapEdge[] } {
  const { nodes, children, rootId } = mindMapData;
  const hiddenIds = getHiddenIds(rootId, children, nodes);
  const { depth } = buildTreeIndex(rootId, children);

  // 이전 노드의 실측 크기(measured)를 물려받는다. 이걸 안 하면 데이터가 바뀔 때마다
  // 크기 정보가 날아가서 레이아웃이 매번 폴백 크기로 되돌아간다.
  const prevById = new Map(prevNodes.map((n) => [n.id, n]));

  // 형제 세로 순서는 레이아웃(applyTreeLayout)이 edge 순서로 결정하므로
  // 여기서 노드 나열 순서는 중요하지 않다.
  // selected는 항상 selectedNodeId로 재계산한다 → 데이터 변경으로 rfNodes를 다시
  // 만들어도(이동/편집 등) 선택 링이 유지된다. (단일 선택 단일 출처)
  const rfNodes: MindMapNode[] = Object.values(nodes).map((node) => {
    const prev = prevById.get(node.id);
    const next: MindMapNode = {
      id: node.id,
      type: node.type === 'table' ? 'tableNode' : 'textNode',
      position: positions[node.id] ?? { x: 0, y: 0 },
      data: node,
      hidden: hiddenIds.has(node.id),
      selected: node.id === selectedNodeId,
    };
    if (prev?.measured) next.measured = prev.measured;
    if (prev?.width != null) next.width = prev.width;
    if (prev?.height != null) next.height = prev.height;
    return next;
  });

  const rfEdges: MindMapEdge[] = [];
  for (const [parentId, childIds] of Object.entries(children)) {
    for (const childId of childIds) {
      rfEdges.push({
        id: `${parentId}-${childId}`,
        source: parentId,
        target: childId,
        type: 'bezierEdge',
        // 간선 색은 자식 노드 색을 따라간다 → 가지에 색을 칠하면 선까지 한 테마
        data: { depth: depth.get(parentId) ?? 0, color: nodes[childId]?.style?.color },
        hidden: hiddenIds.has(childId),
      });
    }
  }

  return { rfNodes, rfEdges };
}

/**
 * 데이터 → 파생 상태(rfNodes/rfEdges/positions) 투영.
 * relayout=true면 자동 배치까지 수행해 positions를 새로 만든다.
 */
function project(
  mindMapData: MindMapData,
  positions: Positions,
  selectedNodeId: string | null,
  prevNodes: MindMapNode[],
  relayout: boolean
): { rfNodes: MindMapNode[]; rfEdges: MindMapEdge[]; positions: Positions } {
  const { rfNodes, rfEdges } = buildReactFlow(mindMapData, positions, selectedNodeId, prevNodes);
  if (!relayout) return { rfNodes, rfEdges, positions };
  const laidOut = applyTreeLayout(rfNodes, rfEdges);
  const newPositions = Object.fromEntries(laidOut.map((n) => [n.id, n.position]));
  return { rfNodes: laidOut, rfEdges, positions: newPositions };
}

// ─── 스토어 타입 ──────────────────────────────────────────────
export type NavDirection = 'up' | 'down' | 'left' | 'right';

interface MindMapStoreState {
  mindMapData: MindMapData;
  rfNodes: MindMapNode[];
  rfEdges: MindMapEdge[];
  positions: Positions;
  selectedNodeId: string | null;
  // 인라인 라벨 편집 중인 노드. 더블클릭/F2/Tab·Enter로 생성 직후 켜진다.
  editingNodeId: string | null;
  isNoteDrawerOpen: boolean;
  noteDrawerWidth: number;
  // 캔버스를 특정 노드로 이동시켜 달라는 요청. seq는 같은 노드를 연속 요청해도
  // 값이 바뀌게 해서 useEffect가 매번 발화하도록 하는 토큰이다.
  // center=true면 무조건 화면 중앙으로, false면 화면 밖일 때만 따라간다.
  focusRequest: { id: string; seq: number; center: boolean } | null;
  /** 증가할 때마다 캔버스가 fitView 한다. 맵을 새로 열거나 전체 펼침/접힘 후. */
  fitRequest: number;
  isSearchOpen: boolean;
  /** 단축키 도움말 모달. 기능이 있어도 못 찾으면 없는 것과 같아서 둔다. */
  isShortcutsOpen: boolean;
  // 자동 저장 상태. 실패를 조용히 넘기지 않고 화면에 드러내기 위한 것.
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: number | null;
  // 다른 탭이 같은 맵을 저장했을 때 세워지는 깃발. 사용자에게 알리고 선택을 맡긴다.
  hasExternalChange: boolean;
}

interface MindMapStoreActions {
  // 자식 노드를 추가하고 새 노드 id를 반환한다. index 생략 시 맨 끝에 붙는다.
  addChildNode: (parentId: string, type?: 'text' | 'table', index?: number) => string;
  // nodeId 바로 다음 위치에 형제 노드를 추가한다. 루트면 null.
  addSiblingNode: (nodeId: string) => string | null;
  updateNodeLabel: (id: string, label: string) => void;
  deleteNode: (id: string) => void;
  deleteNodes: (ids: string[]) => void;
  reparentNode: (nodeId: string, newParentId: string) => void;
  moveNode: (nodeId: string, newParentId: string, index: number) => void;
  toggleCollapse: (id: string) => void;
  // 모두 펼치기(false) / 모두 접기(true). 루트는 접지 않는다.
  setAllCollapsed: (collapsed: boolean) => void;
  // 그 깊이까지만 펼친다. 루트가 0단계이므로 expandToLevel(1)이면 루트의 자식까지 보인다.
  expandToLevel: (depth: number) => void;
  requestFitView: () => void;
  updateNodeNote: (id: string, note: string) => void;
  updateNodeTableData: (id: string, tableData: NonNullable<MindNode['tableData']>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setEditingNodeId: (id: string | null) => void;
  // 방향키 탐색: 선택을 부모/첫 자식/이전·다음 형제로 옮긴다.
  selectRelative: (dir: NavDirection) => void;
  // 접힌 조상을 모두 펼쳐 해당 노드를 화면에 드러낸다.
  revealNode: (id: string) => void;
  focusNode: (id: string, center?: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null, savedAt?: number) => void;
  setExternalChange: (value: boolean) => void;
  openNoteDrawer: (nodeId: string) => void;
  closeNoteDrawer: () => void;
  setNoteDrawerWidth: (width: number) => void;
  onRfNodesChange: (changes: NodeChange[]) => void;
  onRfEdgesChange: (changes: EdgeChange[]) => void;
  applyLayout: () => void;
  loadFromPersisted: (mindMapData: MindMapData, positions: Positions) => void;
  syncRfFromData: () => void;
  // 맵 제목 변경 (과목 이름). 내보내기 파일명과 맵 목록에 쓰인다.
  // 노드 색 지정. color=null이면 기본색으로 되돌린다.
  // includeSubtree면 후손까지 함께 칠해 가지 전체를 한 테마로 만든다.
  setNodeColor: (id: string, color: string | null, includeSubtree?: boolean) => void;
  setMapTitle: (title: string) => void;
  // 다른 맵으로 갈아탄다. undo 히스토리는 맵 경계를 넘지 않아야 하므로 함께 비운다.
  openMap: (mindMapData: MindMapData, positions: Positions) => void;
}

type MindMapStore = MindMapStoreState & MindMapStoreActions;

const { rfNodes: _initNodes, rfEdges: initialRfEdges } = buildReactFlow(initialMindMapData, {});
const initialRfNodes = applyTreeLayout(_initNodes, initialRfEdges);

// ─── 스토어 ───────────────────────────────────────────────────
export const useMindMapStore = create<MindMapStore>()(
  temporal(
    (set, get) => ({
      mindMapData: initialMindMapData,
      rfNodes: initialRfNodes,
      rfEdges: initialRfEdges,
      positions: {},
      selectedNodeId: null,
      editingNodeId: null,
      isNoteDrawerOpen: false,
      noteDrawerWidth: 360,
      focusRequest: null,
      fitRequest: 0,
      isSearchOpen: false,
      isShortcutsOpen: false,
      saveStatus: 'idle',
      saveError: null,
      lastSavedAt: null,
      hasExternalChange: false,

      addChildNode: (parentId, type = 'text', index) => {
        const { mindMapData, positions, rfNodes } = get();
        const newId = nanoid(8);
        const newNode: MindNode = { id: newId, type, label: '새 노드', note: '', collapsed: false };
        // index 위치에 삽입 (생략 시 맨 끝)
        const siblings = mindMapData.children[parentId] ?? [];
        const at = index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length));
        const newSiblings = [...siblings];
        newSiblings.splice(at, 0, newId);
        const newData: MindMapData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [newId]: newNode },
          children: {
            ...mindMapData.children,
            [parentId]: newSiblings,
            [newId]: [],
          },
        };
        // 새 노드를 곧바로 선택한다 (키보드 흐름: 생성 → 선택 → 편집)
        set({
          mindMapData: newData,
          selectedNodeId: newId,
          ...project(newData, positions, newId, rfNodes, true),
        });
        return newId;
      },

      // 형제 추가 = nodeId의 부모에 nodeId 바로 다음 위치로 자식 추가.
      addSiblingNode: (nodeId) => {
        const { mindMapData } = get();
        if (nodeId === mindMapData.rootId) return null; // 루트는 형제가 없음
        const parentId = findParent(nodeId, mindMapData.children);
        if (parentId === null) return null;
        const siblings = mindMapData.children[parentId] ?? [];
        const idx = siblings.indexOf(nodeId);
        return get().addChildNode(parentId, 'text', idx + 1);
      },

      updateNodeLabel: (id, label) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...mindMapData.nodes[id], label } },
        };
        // 라벨 길이가 바뀌면 노드 폭도 바뀐다. 실측은 렌더 후에야 오므로 여기서는
        // 배치를 미루고, onRfNodesChange의 dimensions 변경 처리에서 재배치한다.
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, false) });
      },

      // 끝에 붙이는 단순 재배치 (moveNode의 append 형태)
      reparentNode: (nodeId, newParentId) =>
        get().moveNode(nodeId, newParentId, Number.MAX_SAFE_INTEGER),

      // nodeId를 newParentId의 children 중 index 위치로 이동.
      // 같은 부모 안에서도 동작하므로 형제 순서 변경(reorder)에 쓰인다.
      moveNode: (nodeId, newParentId, index) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
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
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, true) });
      },

      deleteNode: (id) => get().deleteNodes([id]),

      deleteNodes: (ids) => {
        const { mindMapData, positions, rfNodes } = get();
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
        set({
          mindMapData: newData,
          selectedNodeId: null,
          isNoteDrawerOpen: false,
          ...project(newData, positions, null, rfNodes, true),
        });
      },

      toggleCollapse: (id) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const node = mindMapData.nodes[id];
        if (!node) return;
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...node, collapsed: !node.collapsed } },
        };
        // 접거나 펴면 보이는 노드 집합이 달라지므로 다시 배치해 빈 자리를 메운다
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, true) });
        // 재배치로 방금 누른 노드가 화면 밖으로 밀려나면 따라간다.
        // (center=false 라 화면 안에 남아 있으면 화면이 움직이지 않는다)
        get().focusNode(id);
      },

      /**
       * 모두 펼치기 / 모두 접기.
       * 접을 때 루트는 제외한다 — 루트까지 접으면 노드 하나만 남아 맵이 사라진 것처럼 보인다.
       */
      setAllCollapsed: (collapsed) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const newNodes: Record<string, MindNode> = {};
        let changed = false;
        for (const [nodeId, node] of Object.entries(mindMapData.nodes)) {
          const hasKids = (mindMapData.children[nodeId] ?? []).length > 0;
          const next = collapsed && hasKids && nodeId !== mindMapData.rootId;
          if (node.collapsed !== next) changed = true;
          newNodes[nodeId] = node.collapsed === next ? node : { ...node, collapsed: next };
        }
        if (!changed) return;
        const newData = { ...mindMapData, nodes: newNodes };
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, true) });
        get().requestFitView();
      },

      /**
       * 그 깊이까지만 펼친다 (루트=0단계).
       *
       * "전체를 펼치면 너무 많고 다 접으면 너무 적다"를 푸는 것이 목적이다.
       * 217노드짜리 맵에서 1단계는 주제 목록, 2단계는 주제+분류가 된다.
       * 잎 노드는 접어봐야 보이는 게 같으므로 건드리지 않는다 — 그래야
       * 나중에 자식이 생겼을 때 갑자기 접힌 채로 나타나지 않는다.
       */
      expandToLevel: (depth) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const { depth: depthOf } = buildTreeIndex(mindMapData.rootId, mindMapData.children);
        const newNodes: Record<string, MindNode> = {};
        let changed = false;
        for (const [nodeId, node] of Object.entries(mindMapData.nodes)) {
          const hasKids = (mindMapData.children[nodeId] ?? []).length > 0;
          // 트리에 매달려 있지 않은 노드는 깊이를 알 수 없다 — 건드리지 않는다.
          const d = depthOf.get(nodeId);
          const next = hasKids && d !== undefined && d >= depth;
          if (node.collapsed !== next) changed = true;
          newNodes[nodeId] = node.collapsed === next ? node : { ...node, collapsed: next };
        }
        if (!changed) return;
        const newData = { ...mindMapData, nodes: newNodes };
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, true) });
        get().requestFitView();
      },

      /** 화면을 맵 전체에 맞춰달라고 캔버스에 요청한다 (실제 fitView는 MindMapCanvas가 한다) */
      requestFitView: () =>
        set((state) => ({ fitRequest: (state.fitRequest ?? 0) + 1 })),

      updateNodeNote: (id, note) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...mindMapData.nodes[id], note } },
        };
        // 노트 타이핑은 undo 히스토리에 넣지 않는다. BlockNote가 자체 undo를 가지고 있고,
        // 300ms마다 문서 전체 스냅샷이 쌓이면 캔버스 Ctrl+Z가 "타이핑 되돌리기"로 변질된다.
        const temporalState = useMindMapStore.temporal.getState();
        const wasTracking = temporalState.isTracking;
        if (wasTracking) temporalState.pause();
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, false) });
        if (wasTracking) temporalState.resume();
      },

      updateNodeTableData: (id, tableData) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const newData = {
          ...mindMapData,
          nodes: { ...mindMapData.nodes, [id]: { ...mindMapData.nodes[id], tableData } },
        };
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, false) });
      },

      // 선택 변경 시 rfNodes의 selected 플래그도 갱신 → 링 표시가 store 선택을 따른다.
      // (키보드로 만든/선택한 노드가 곧바로 강조되고, Delete 대상으로도 잡힌다)
      setSelectedNodeId: (id) =>
        set((state) => ({
          selectedNodeId: id,
          rfNodes: state.rfNodes.map((n) =>
            n.selected === (n.id === id) ? n : { ...n, selected: n.id === id }
          ),
        })),

      setEditingNodeId: (id) => set({ editingNodeId: id }),

      // LR 배치 기준 방향키 탐색.
      // 오른쪽 = 첫 자식(접혀 있으면 먼저 펼침), 왼쪽 = 부모, 위/아래 = 형제.
      selectRelative: (dir) => {
        const { mindMapData, selectedNodeId } = get();
        const { children, nodes, rootId } = mindMapData;

        // 선택이 없으면 루트부터 시작
        if (!selectedNodeId || !nodes[selectedNodeId]) {
          get().setSelectedNodeId(rootId);
          get().focusNode(rootId);
          return;
        }

        const go = (id: string) => {
          get().setSelectedNodeId(id);
          get().focusNode(id);
        };

        if (dir === 'right') {
          const kids = children[selectedNodeId] ?? [];
          if (kids.length === 0) return;
          if (nodes[selectedNodeId].collapsed) get().toggleCollapse(selectedNodeId);
          go(kids[0]);
          return;
        }

        const parentId = findParent(selectedNodeId, children);

        if (dir === 'left') {
          if (parentId) go(parentId);
          return;
        }

        if (!parentId) return; // 루트는 형제가 없다
        const sibs = children[parentId] ?? [];
        const i = sibs.indexOf(selectedNodeId);
        const next = dir === 'up' ? i - 1 : i + 1;
        if (next >= 0 && next < sibs.length) go(sibs[next]);
      },

      revealNode: (id) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const { parent } = buildTreeIndex(mindMapData.rootId, mindMapData.children);
        // 접혀 있는 조상만 모아서 한 번에 펼친다
        const toOpen: string[] = [];
        let cur = parent.get(id);
        while (cur) {
          if (mindMapData.nodes[cur]?.collapsed) toOpen.push(cur);
          cur = parent.get(cur);
        }
        if (toOpen.length === 0) return;
        const newNodes = { ...mindMapData.nodes };
        for (const ancestorId of toOpen) {
          newNodes[ancestorId] = { ...newNodes[ancestorId], collapsed: false };
        }
        const newData = { ...mindMapData, nodes: newNodes };
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, true) });
      },

      focusNode: (id, center = false) =>
        set((state) => ({
          focusRequest: { id, center, seq: (state.focusRequest?.seq ?? 0) + 1 },
        })),

      setSearchOpen: (open) => set({ isSearchOpen: open }),

      setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),

      setSaveStatus: (status, error = null, savedAt) =>
        set((state) => ({
          saveStatus: status,
          saveError: error,
          lastSavedAt: savedAt ?? state.lastSavedAt,
        })),

      setExternalChange: (value) => set({ hasExternalChange: value }),

      openNoteDrawer: (nodeId) => set({ selectedNodeId: nodeId, isNoteDrawerOpen: true }),

      closeNoteDrawer: () => set({ isNoteDrawerOpen: false }),

      setNoteDrawerWidth: (width) => {
        const clamped = Math.max(280, Math.min(width, window.innerWidth * 0.75));
        localStorage.setItem('note-panel-width', String(clamped));
        set({ noteDrawerWidth: clamped });
      },

      onRfNodesChange: (changes) => {
        const prevNodes = get().rfNodes;

        // dimensions 이벤트가 하나도 없으면 크기는 그대로다 → 비교조차 하지 않는다
        const hasDimensionChange = changes.some((c) => c.type === 'dimensions');
        const nextNodes = applyNodeChanges(changes, prevNodes) as MindMapNode[];
        if (!hasDimensionChange) {
          set({ rfNodes: nextNodes });
          return;
        }

        // dimensions 이벤트가 왔다고 크기가 실제로 바뀐 건 아니다. ReactFlow는 리사이즈
        // 관찰자가 발화할 때마다 같은 값으로도 알려주기 때문에, 값이 정말 달라졌을 때만
        // 재배치한다. (표 셀에 타이핑할 때마다 전체 트리를 다시 계산하던 낭비 제거)
        const sizeKey = (n: MindMapNode) => `${n.measured?.width ?? 0}x${n.measured?.height ?? 0}`;
        const prevSizes = new Map(prevNodes.map((n) => [n.id, sizeKey(n)]));
        const resized = nextNodes.some((n) => prevSizes.get(n.id) !== sizeKey(n));
        if (!resized) {
          set({ rfNodes: nextNodes });
          return;
        }

        // 배치 결과는 데이터에서 파생되므로 히스토리에는 남지 않는다 (equality가 mindMapData만 비교)
        const laidOut = applyTreeLayout(nextNodes, get().rfEdges);
        set({
          rfNodes: laidOut,
          positions: Object.fromEntries(laidOut.map((n) => [n.id, n.position])),
        });
      },

      onRfEdgesChange: (changes) => {
        set((state) => ({
          rfEdges: applyEdgeChanges(changes, state.rfEdges) as MindMapEdge[],
        }));
      },

      applyLayout: () => {
        const { rfNodes, rfEdges } = get();
        const laidOut = applyTreeLayout(rfNodes, rfEdges);
        set({
          rfNodes: laidOut,
          positions: Object.fromEntries(laidOut.map((n) => [n.id, n.position])),
        });
      },

      loadFromPersisted: (mindMapData, positions) => {
        // 다른 맵을 불러오는 것이므로 이전 노드의 실측 크기는 물려받지 않는다
        set({ mindMapData, ...project(mindMapData, positions, get().selectedNodeId, [], false) });
      },

      setNodeColor: (id, color, includeSubtree = false) => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        if (!mindMapData.nodes[id]) return;

        const targets = includeSubtree
          ? collectSubtree(id, mindMapData.children)
          : new Set([id]);

        const newNodes = { ...mindMapData.nodes };
        for (const targetId of targets) {
          const node = newNodes[targetId];
          if (!node) continue;
          newNodes[targetId] = { ...node, style: color ? { ...node.style, color } : undefined };
        }

        const newData = { ...mindMapData, nodes: newNodes };
        // 색은 크기를 바꾸지 않으므로 재배치는 불필요
        set({ mindMapData: newData, ...project(newData, positions, selectedNodeId, rfNodes, false) });
      },

      setMapTitle: (title) =>
        set((state) => ({ mindMapData: { ...state.mindMapData, title } })),

      openMap: (mindMapData, positions) => {
        // 위치가 저장돼 있지 않은 맵(새로 만든 맵)은 곧바로 배치한다
        const relayout = Object.keys(positions).length === 0;
        set({
          mindMapData,
          selectedNodeId: null,
          editingNodeId: null,
          isNoteDrawerOpen: false,
          hasExternalChange: false,
          ...project(mindMapData, positions, null, [], relayout),
        });
        // undo가 이전 맵으로 되돌아가면 안 된다
        useMindMapStore.temporal.getState().clear();
        // 이전 맵의 배율·위치가 그대로 남으면 다른 맵을 열었을 때 엉뚱한 데를 보고 있게 된다
        get().requestFitView();
      },

      // undo/redo는 mindMapData/positions만 복원하므로, 파생 상태인
      // rfNodes/rfEdges를 다시 만들어줘야 캔버스에 반영된다.
      syncRfFromData: () => {
        const { mindMapData, positions, selectedNodeId, rfNodes } = get();
        const { rfNodes: next, rfEdges } = buildReactFlow(
          mindMapData,
          positions,
          selectedNodeId,
          rfNodes
        );
        set({ rfNodes: next, rfEdges });
      },
    }),
    {
      partialize: (state) => ({
        mindMapData: state.mindMapData,
        positions: state.positions,
      }),
      // mindMapData 참조가 실제로 바뀐 set만 히스토리에 기록한다.
      // positions는 mindMapData에서 파생되는 배치 결과일 뿐이라 비교 대상이 아니다.
      // (측정에 따른 재배치가 히스토리를 오염시키던 원인)
      equality: (a, b) => a.mindMapData === b.mindMapData,
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
