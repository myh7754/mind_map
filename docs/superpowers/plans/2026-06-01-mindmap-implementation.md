# Mind Map Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** XMind/EdrawMind 스타일의 마인드맵 + 노드별 위키 노트 하이브리드 웹 애플리케이션을 React + TypeScript로 구현한다.

**Architecture:** zustand 스토어가 `MindMapData`(콘텐츠 트리)와 react-flow의 `Node[]`/`Edge[]`를 동기화하는 단일 진실 공급원 역할을 한다. IndexedDB가 자동 저장을 담당하고, dagre가 트리 레이아웃을 계산한다. BlockNote가 노드별 WYSIWYG 마크다운 편집을 처리한다.

**Tech Stack:** Vite 5, React 18, TypeScript, @xyflow/react v12, dagre, zustand + zundo, BlockNote, Tailwind CSS, idb, file-saver, Vitest

---

## 파일 구조

```
src/
├── types/index.ts                         — 모든 TypeScript 인터페이스
├── store/useMindMapStore.ts               — zustand 상태 + zundo undo/redo
├── db/mindmapDB.ts                        — IndexedDB (idb) save/load
├── utils/
│   ├── layout.ts                          — dagre 자동 레이아웃
│   ├── exportMarkdown.ts                  — 트리 → 마크다운 변환
│   └── exportJson.ts                      — JSON 파일 저장/불러오기
├── components/
│   ├── MindMapCanvas/
│   │   ├── MindMapCanvas.tsx              — @xyflow/react 래퍼
│   │   ├── TextNode.tsx                   — 텍스트 노드 (노트 버튼 + 접기)
│   │   ├── TableNode.tsx                  — 테이블 데이터 노드
│   │   └── BezierEdge.tsx                 — S-곡선 커스텀 엣지
│   ├── NoteDrawer/
│   │   ├── NoteDrawer.tsx                 — 슬라이드 패널 래퍼
│   │   ├── ResizeHandle.tsx               — 드래그 너비 조절 핸들
│   │   └── BlockNoteEditor.tsx            — BlockNote WYSIWYG 래퍼
│   └── Toolbar/
│       └── Toolbar.tsx                    — 상단 액션 바
├── test/setup.ts                          — Vitest 전역 설정
├── App.tsx                                — 루트 조합 + 자동 저장
├── main.tsx
└── index.css
```

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `src/index.css`, `src/main.tsx`, `src/test/setup.ts`

- [ ] **Step 1: Vite 프로젝트 생성**

```bash
cd D:/develop/project/ClaudeCode/mind_map
npm create vite@latest . -- --template react-ts
```
Expected: `package.json`, `src/App.tsx`, `vite.config.ts` 생성됨

- [ ] **Step 2: 의존성 설치**

```bash
npm install @xyflow/react @dagrejs/dagre zustand zundo @blocknote/core @blocknote/react @blocknote/mantine @mantine/core @mantine/hooks idb file-saver nanoid
npm install -D tailwindcss postcss autoprefixer @types/file-saver vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```
Expected: `node_modules/` 생성, `package.json` 의존성 추가됨

- [ ] **Step 3: Tailwind CSS 초기화**

```bash
npx tailwindcss init -p
```

`tailwind.config.ts` 내용:
```typescript
import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; padding: 0; }
```

- [ ] **Step 4: Vitest 설정**

`vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

`src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: 기존 보일러플레이트 제거 후 개발 서버 확인**

`src/App.tsx`를 아래 내용으로 교체:
```typescript
export default function App() {
  return <div className="h-full bg-slate-950 text-white flex items-center justify-center">Mind Map</div>;
}
```

```bash
npm run dev
```
Expected: `http://localhost:5173` 에서 "Mind Map" 텍스트 표시

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: initial project scaffolding"
```

---

## Task 2: TypeScript 타입 정의

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: 타입 파일 작성**

`src/types/index.ts`:
```typescript
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
export type MindMapEdge = Edge<{ depth: number }>;
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript types"
```

---

## Task 3: Zustand 스토어 + Undo/Redo

**Files:**
- Create: `src/store/useMindMapStore.ts`

- [ ] **Step 1: 헬퍼 함수 작성 (스토어 파일 상단)**

`src/store/useMindMapStore.ts`:
```typescript
import { create } from 'zustand';
import { temporal } from 'zundo';
import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from '@xyflow/react';
import type { MindNode, MindMapData, MindMapNode, MindMapEdge } from '../types';
import { applyDagreLayout } from '../utils/layout';
import { nanoid } from 'nanoid';

// 초기 마인드맵 데이터
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

// 깊이 계산
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

// collapsed 노드의 모든 자손 ID 수집
function getHiddenIds(
  nodeId: string,
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
  check(nodeId);
  return hidden;
}

// MindMapData → react-flow Node[], Edge[] 변환
function buildReactFlow(
  mindMapData: MindMapData,
  positions: Record<string, { x: number; y: number }>
): { rfNodes: MindMapNode[]; rfEdges: MindMapEdge[] } {
  const { nodes, children, rootId } = mindMapData;
  const hiddenIds = getHiddenIds(rootId, children, nodes);

  const rfNodes: MindMapNode[] = Object.values(nodes).map((node) => ({
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
```

- [ ] **Step 2: 스토어 인터페이스 + 구현 작성**

동일 파일에 이어서 작성:
```typescript
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
}

type MindMapStore = MindMapStoreState & MindMapStoreActions;

const { rfNodes: initialRfNodes, rfEdges: initialRfEdges } = buildReactFlow(initialMindMapData, {});

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

      deleteNode: (id) => {
        const { mindMapData, positions } = get();
        if (id === mindMapData.rootId) return;
        // 삭제할 노드 + 모든 자손 수집
        const toDelete = new Set<string>([id]);
        const queue = [id];
        while (queue.length > 0) {
          const cur = queue.shift()!;
          for (const childId of mindMapData.children[cur] ?? []) {
            toDelete.add(childId);
            queue.push(childId);
          }
        }
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
        set({ mindMapData: newData, rfNodes: laidOut, rfEdges, positions: newPositions, selectedNodeId: null, isNoteDrawerOpen: false });
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
        set((state) => {
          const updated = applyNodeChanges(changes, state.rfNodes) as MindMapNode[];
          const newPositions = Object.fromEntries(updated.map((n) => [n.id, n.position]));
          return { rfNodes: updated, positions: { ...state.positions, ...newPositions } };
        });
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
    }),
    {
      partialize: (state) => ({
        mindMapData: state.mindMapData,
        positions: state.positions,
      }),
    }
  )
);

// undo/redo 편의 훅
export const useUndoRedo = () => {
  const { undo, redo, pastStates, futureStates } = useMindMapStore.temporal.getState();
  return {
    undo,
    redo,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
  };
};
```

- [ ] **Step 3: Commit**

```bash
git add src/store/useMindMapStore.ts
git commit -m "feat: add zustand store with undo/redo"
```

---

## Task 4: IndexedDB 영속성 레이어

**Files:**
- Create: `src/db/mindmapDB.ts`

- [ ] **Step 1: IndexedDB 헬퍼 작성**

`src/db/mindmapDB.ts`:
```typescript
import { openDB, type IDBPDatabase } from 'idb';
import type { MindMapData, PersistedState } from '../types';

const DB_NAME = 'mindmap-db';
const STORE_NAME = 'maps';
const DB_VERSION = 1;

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

export async function saveMindMap(
  mindMapData: MindMapData,
  positions: Record<string, { x: number; y: number }>
): Promise<void> {
  const db = await getDB();
  const record: PersistedState & { id: string } = {
    id: mindMapData.id,
    mindMapData,
    positions,
  };
  await db.put(STORE_NAME, record);
}

export async function loadMindMap(id: string): Promise<PersistedState | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/db/mindmapDB.ts
git commit -m "feat: add IndexedDB persistence layer"
```

---

## Task 5: 유틸리티 함수 (레이아웃 + 내보내기)

**Files:**
- Create: `src/utils/layout.ts`, `src/utils/exportMarkdown.ts`, `src/utils/exportJson.ts`
- Test: `src/utils/exportMarkdown.test.ts`, `src/utils/layout.test.ts`

- [ ] **Step 1: Dagre 레이아웃 유틸 작성**

`src/utils/layout.ts`:
```typescript
import dagre from '@dagrejs/dagre';
import type { MindMapNode, MindMapEdge } from '../types';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 40;

export function applyDagreLayout(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): MindMapNode[] {
  const visibleNodes = nodes.filter((n) => !n.hidden);
  const visibleEdges = edges.filter((e) => !e.hidden);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 80 });

  visibleNodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  visibleEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    if (node.hidden) return node;
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });
}
```

- [ ] **Step 2: 레이아웃 테스트 작성**

`src/utils/layout.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { applyDagreLayout } from './layout';
import type { MindMapNode, MindMapEdge } from '../types';

const makeNode = (id: string): MindMapNode => ({
  id,
  type: 'textNode',
  position: { x: 0, y: 0 },
  data: { id, type: 'text', label: id, note: '', collapsed: false },
});

const makeEdge = (source: string, target: string): MindMapEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { depth: 0 },
});

describe('applyDagreLayout', () => {
  it('should assign non-zero positions to visible nodes', () => {
    const nodes = [makeNode('root'), makeNode('child')];
    const edges = [makeEdge('root', 'child')];
    const result = applyDagreLayout(nodes, edges);
    expect(result[0].position).not.toEqual({ x: 0, y: 0 });
    expect(result[1].position).not.toEqual({ x: 0, y: 0 });
  });

  it('should place root to the left of child (LR direction)', () => {
    const nodes = [makeNode('root'), makeNode('child')];
    const edges = [makeEdge('root', 'child')];
    const result = applyDagreLayout(nodes, edges);
    const root = result.find((n) => n.id === 'root')!;
    const child = result.find((n) => n.id === 'child')!;
    expect(root.position.x).toBeLessThan(child.position.x);
  });

  it('should not change position of hidden nodes', () => {
    const hiddenNode: MindMapNode = { ...makeNode('hidden'), hidden: true };
    const nodes = [makeNode('root'), hiddenNode];
    const edges: MindMapEdge[] = [];
    const result = applyDagreLayout(nodes, edges);
    const hidden = result.find((n) => n.id === 'hidden')!;
    expect(hidden.position).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 3: 레이아웃 테스트 실행 확인**

```bash
npx vitest run src/utils/layout.test.ts
```
Expected: 3 tests PASS

- [ ] **Step 4: 마크다운 내보내기 유틸 작성**

`src/utils/exportMarkdown.ts`:
```typescript
import type { MindMapData } from '../types';

function blocknoteJsonToMarkdown(noteJson: string): string {
  if (!noteJson) return '';
  try {
    const blocks: { type: string; content?: { text: string }[] }[] = JSON.parse(noteJson);
    return blocks
      .map((block) => {
        const text = (block.content ?? []).map((c) => c.text).join('');
        if (block.type === 'heading') return `**${text}**`;
        if (block.type === 'bulletListItem') return `- ${text}`;
        if (block.type === 'numberedListItem') return `1. ${text}`;
        return text;
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return noteJson;
  }
}

function buildMarkdown(
  nodeId: string,
  mindMapData: MindMapData,
  depth: number
): string {
  const { nodes, children } = mindMapData;
  const node = nodes[nodeId];
  if (!node) return '';

  const lines: string[] = [];

  if (node.type === 'table' && node.tableData) {
    const { headers, rows } = node.tableData;
    lines.push(`\n| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      lines.push(`| ${row.join(' | ')} |`);
    }
  } else {
    const heading = depth <= 6 ? `${'#'.repeat(depth)} ${node.label}` : `${'  '.repeat(depth - 7)}- ${node.label}`;
    lines.push(heading);
  }

  const noteContent = blocknoteJsonToMarkdown(node.note);
  if (noteContent) lines.push('\n' + noteContent);

  for (const childId of children[nodeId] ?? []) {
    lines.push('\n' + buildMarkdown(childId, mindMapData, depth + 1));
  }

  return lines.join('\n');
}

export function exportToMarkdown(mindMapData: MindMapData): string {
  return buildMarkdown(mindMapData.rootId, mindMapData, 1).trim();
}
```

- [ ] **Step 5: 마크다운 내보내기 테스트 작성**

`src/utils/exportMarkdown.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { exportToMarkdown } from './exportMarkdown';
import type { MindMapData } from '../types';

const sampleData: MindMapData = {
  id: 'test',
  title: '테스트',
  rootId: 'root',
  children: {
    root: ['child1', 'child2'],
    child1: ['grandchild'],
    child2: [],
    grandchild: [],
  },
  nodes: {
    root: { id: 'root', type: 'text', label: '루트', note: '', collapsed: false },
    child1: { id: 'child1', type: 'text', label: '키워드 A', note: '', collapsed: false },
    child2: { id: 'child2', type: 'text', label: '키워드 B', note: '', collapsed: false },
    grandchild: { id: 'grandchild', type: 'text', label: '세부 1', note: '', collapsed: false },
  },
};

describe('exportToMarkdown', () => {
  it('should render root as H1', () => {
    const md = exportToMarkdown(sampleData);
    expect(md).toContain('# 루트');
  });

  it('should render children as H2', () => {
    const md = exportToMarkdown(sampleData);
    expect(md).toContain('## 키워드 A');
    expect(md).toContain('## 키워드 B');
  });

  it('should render grandchildren as H3', () => {
    const md = exportToMarkdown(sampleData);
    expect(md).toContain('### 세부 1');
  });

  it('should render table node as markdown table', () => {
    const dataWithTable: MindMapData = {
      ...sampleData,
      children: { root: ['table1'], table1: [] },
      nodes: {
        root: sampleData.nodes.root,
        table1: {
          id: 'table1',
          type: 'table',
          label: '표',
          note: '',
          collapsed: false,
          tableData: { headers: ['A', 'B'], rows: [['1', '2']] },
        },
      },
    };
    const md = exportToMarkdown(dataWithTable);
    expect(md).toContain('| A | B |');
    expect(md).toContain('| 1 | 2 |');
  });
});
```

- [ ] **Step 6: 마크다운 테스트 실행 확인**

```bash
npx vitest run src/utils/exportMarkdown.test.ts
```
Expected: 4 tests PASS

- [ ] **Step 7: JSON 내보내기/불러오기 유틸 작성**

`src/utils/exportJson.ts`:
```typescript
import { saveAs } from 'file-saver';
import type { MindMapData } from '../types';

export function downloadJson(mindMapData: MindMapData): void {
  const json = JSON.stringify(mindMapData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, `${mindMapData.title}.mindmap.json`);
}

export function loadJsonFile(): Promise<MindMapData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return reject(new Error('파일이 선택되지 않았습니다.'));
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as MindMapData;
          resolve(data);
        } catch {
          reject(new Error('유효하지 않은 파일입니다.'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add src/utils/
git commit -m "feat: add layout, markdown export, json export utilities"
```

---

## Task 6: 커스텀 노드 & 엣지 컴포넌트

**Files:**
- Create: `src/components/MindMapCanvas/BezierEdge.tsx`
- Create: `src/components/MindMapCanvas/TextNode.tsx`
- Create: `src/components/MindMapCanvas/TableNode.tsx`

- [ ] **Step 1: BezierEdge 작성**

`src/components/MindMapCanvas/BezierEdge.tsx`:
```typescript
import { type EdgeProps, getStraightPath } from '@xyflow/react';
import type { MindMapEdge } from '../../types';

const EDGE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export function BezierEdge({
  sourceX, sourceY, targetX, targetY,
  data,
}: EdgeProps<MindMapEdge['data']>) {
  const depth = data?.depth ?? 0;
  const color = EDGE_COLORS[Math.min(depth, EDGE_COLORS.length - 1)];
  const strokeWidth = depth === 0 ? 2 : depth === 1 ? 1.5 : 1;

  const d = `M ${sourceX} ${sourceY} C ${sourceX + 60} ${sourceY}, ${targetX - 60} ${targetY}, ${targetX} ${targetY}`;

  return (
    <path
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
    />
  );
}
```

- [ ] **Step 2: TextNode 작성**

`src/components/MindMapCanvas/TextNode.tsx`:
```typescript
import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindNode, MindMapNode } from '../../types';
import { useMindMapStore } from '../../store/useMindMapStore';

export const TextNode = memo(function TextNode({ data, id }: NodeProps<MindMapNode>) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateNodeLabel, toggleCollapse, openNoteDrawer, deleteNode, mindMapData } = useMindMapStore();

  const hasChildren = (mindMapData.children[id] ?? []).length > 0;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (label !== data.label) updateNodeLabel(id, label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  return (
    <div
      className="relative group flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium select-none"
      style={{
        background: data.style?.color ?? '#1e293b',
        borderColor: data.style?.color ? data.style.color + '80' : '#334155',
        color: '#e2e8f0',
        minWidth: 120,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />

      {editing ? (
        <input
          ref={inputRef}
          className="bg-transparent outline-none w-full text-white"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span className="flex-1">{data.label}</span>
      )}

      {/* 액션 버튼 (호버 시 표시) */}
      <div className="hidden group-hover:flex items-center gap-1 ml-1">
        <button
          className="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-500"
          onClick={(e) => { e.stopPropagation(); openNoteDrawer(id); }}
          title="노트 열기"
        >📝</button>
        <button
          className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-white hover:bg-slate-500"
          onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
          title="삭제"
        >✕</button>
      </div>

      {/* 접기/펼치기 버튼 */}
      {hasChildren && (
        <button
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-700 border border-slate-500 text-xs flex items-center justify-center text-slate-300 hover:bg-slate-600 z-10"
          onClick={(e) => { e.stopPropagation(); toggleCollapse(id); }}
          title={data.collapsed ? '펼치기' : '접기'}
        >
          {data.collapsed ? '+' : '−'}
        </button>
      )}

      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});
```

- [ ] **Step 3: TableNode 작성**

`src/components/MindMapCanvas/TableNode.tsx`:
```typescript
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindMapNode } from '../../types';
import { useMindMapStore } from '../../store/useMindMapStore';

export const TableNode = memo(function TableNode({ data, id }: NodeProps<MindMapNode>) {
  const { updateNodeTableData, openNoteDrawer, deleteNode } = useMindMapStore();
  const tableData = data.tableData ?? { headers: ['컬럼 1', '컬럼 2'], rows: [['', '']] };

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const newRows = tableData.rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : row
    );
    updateNodeTableData(id, { ...tableData, rows: newRows });
  };

  const updateHeader = (colIdx: number, value: string) => {
    const newHeaders = tableData.headers.map((h, i) => (i === colIdx ? value : h));
    updateNodeTableData(id, { ...tableData, headers: newHeaders });
  };

  const addRow = () => {
    updateNodeTableData(id, {
      ...tableData,
      rows: [...tableData.rows, tableData.headers.map(() => '')],
    });
  };

  const addColumn = () => {
    updateNodeTableData(id, {
      headers: [...tableData.headers, `컬럼 ${tableData.headers.length + 1}`],
      rows: tableData.rows.map((row) => [...row, '']),
    });
  };

  return (
    <div className="group relative bg-slate-800 border border-slate-600 rounded-lg p-2 min-w-[200px]">
      <Handle type="target" position={Position.Left} className="opacity-0" />

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">📊 {data.label}</span>
        <div className="hidden group-hover:flex gap-1">
          <button className="text-xs px-1 rounded bg-indigo-600 text-white" onClick={() => openNoteDrawer(id)}>📝</button>
          <button className="text-xs px-1 rounded bg-slate-600 text-white" onClick={() => deleteNode(id)}>✕</button>
        </div>
      </div>

      <table className="text-xs w-full border-collapse">
        <thead>
          <tr>
            {tableData.headers.map((header, ci) => (
              <th key={ci} className="border border-slate-600 p-1">
                <input
                  className="bg-transparent text-slate-200 font-semibold w-full outline-none"
                  value={header}
                  onChange={(e) => updateHeader(ci, e.target.value)}
                />
              </th>
            ))}
            <th className="border border-slate-700 p-1">
              <button className="text-slate-500 hover:text-slate-300" onClick={addColumn}>+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-slate-700 p-1">
                  <input
                    className="bg-transparent text-slate-300 w-full outline-none"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                  />
                </td>
              ))}
              <td className="border border-slate-700" />
            </tr>
          ))}
          <tr>
            <td colSpan={tableData.headers.length + 1} className="border border-slate-700 p-1 text-center">
              <button className="text-slate-500 hover:text-slate-300 text-xs" onClick={addRow}>+ 행 추가</button>
            </td>
          </tr>
        </tbody>
      </table>

      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/MindMapCanvas/
git commit -m "feat: add custom node and edge components"
```

---

## Task 7: MindMapCanvas

**Files:**
- Create: `src/components/MindMapCanvas/MindMapCanvas.tsx`

- [ ] **Step 1: MindMapCanvas 작성**

`src/components/MindMapCanvas/MindMapCanvas.tsx`:
```typescript
import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '../../store/useMindMapStore';
import { TextNode } from './TextNode';
import { TableNode } from './TableNode';
import { BezierEdge } from './BezierEdge';

const nodeTypes: NodeTypes = {
  textNode: TextNode,
  tableNode: TableNode,
};

const edgeTypes: EdgeTypes = {
  bezierEdge: BezierEdge,
};

export function MindMapCanvas() {
  const { rfNodes, rfEdges, onRfNodesChange, onRfEdgesChange } = useMindMapStore();

  return (
    <div className="flex-1 h-full bg-slate-950">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onRfNodesChange}
        onEdgesChange={onRfEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="!bg-slate-800 !border-slate-700 !text-slate-300" />
        <MiniMap
          className="!bg-slate-900 !border-slate-700"
          nodeColor="#334155"
          maskColor="rgba(15,23,42,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MindMapCanvas/MindMapCanvas.tsx
git commit -m "feat: add MindMapCanvas with react-flow"
```

---

## Task 8: NoteDrawer

**Files:**
- Create: `src/components/NoteDrawer/ResizeHandle.tsx`
- Create: `src/components/NoteDrawer/BlockNoteEditor.tsx`
- Create: `src/components/NoteDrawer/NoteDrawer.tsx`

- [ ] **Step 1: ResizeHandle 작성**

`src/components/NoteDrawer/ResizeHandle.tsx`:
```typescript
import { useCallback, useRef } from 'react';
import { useMindMapStore } from '../../store/useMindMapStore';

export function ResizeHandle() {
  const { noteDrawerWidth, setNoteDrawerWidth } = useMindMapStore();
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startWidth.current = noteDrawerWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [noteDrawerWidth]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    const delta = startX.current - e.clientX;
    setNoteDrawerWidth(startWidth.current + delta);
  }, [setNoteDrawerWidth]);

  return (
    <div
      className="w-1.5 cursor-col-resize flex items-center justify-center flex-shrink-0 hover:bg-indigo-600 transition-colors bg-slate-700 group"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <div className="w-0.5 h-8 rounded bg-slate-500 group-hover:bg-indigo-400" />
    </div>
  );
}
```

- [ ] **Step 2: BlockNoteEditor 작성**

`src/components/NoteDrawer/BlockNoteEditor.tsx`:
```typescript
import { useEffect, useCallback } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useMindMapStore } from '../../store/useMindMapStore';

interface BlockNoteEditorProps {
  nodeId: string;
  note: string;
}

export function BlockNoteEditor({ nodeId, note }: BlockNoteEditorProps) {
  const { updateNodeNote } = useMindMapStore();
  const editor = useCreateBlockNote();

  // 노드가 바뀔 때 에디터 내용 교체
  useEffect(() => {
    try {
      const blocks = note ? JSON.parse(note) : [];
      const content = blocks.length
        ? blocks
        : [{ id: '1', type: 'paragraph', props: {}, content: [], children: [] }];
      editor.replaceBlocks(editor.document, content);
    } catch {
      // 빈 상태 유지
    }
  }, [nodeId]); // nodeId 바뀔 때만 실행 (note 변경 시에는 무한루프 방지)

  const handleChange = useCallback(() => {
    updateNodeNote(nodeId, JSON.stringify(editor.document));
  }, [nodeId, updateNodeNote]);

  return (
    <div className="flex-1 overflow-y-auto">
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme="dark"
      />
    </div>
  );
}
```

- [ ] **Step 3: NoteDrawer 작성**

`src/components/NoteDrawer/NoteDrawer.tsx`:
```typescript
import { useMindMapStore } from '../../store/useMindMapStore';
import { ResizeHandle } from './ResizeHandle';
import { BlockNoteEditor } from './BlockNoteEditor';

export function NoteDrawer() {
  const {
    isNoteDrawerOpen,
    selectedNodeId,
    noteDrawerWidth,
    mindMapData,
    closeNoteDrawer,
  } = useMindMapStore();

  const node = selectedNodeId ? mindMapData.nodes[selectedNodeId] : null;

  return (
    <div
      className="flex h-full transition-all duration-200 flex-shrink-0"
      style={{ width: isNoteDrawerOpen ? noteDrawerWidth : 0, overflow: 'hidden' }}
    >
      {isNoteDrawerOpen && node && (
        <>
          <ResizeHandle />
          <div className="flex flex-col flex-1 bg-slate-900 border-l border-indigo-900 min-w-0">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 text-sm">📝</span>
                <span className="text-slate-200 text-sm font-medium truncate">{node.label}</span>
              </div>
              <button
                className="text-slate-500 hover:text-slate-300 text-sm"
                onClick={closeNoteDrawer}
              >
                ✕
              </button>
            </div>

            {/* 에디터 */}
            <BlockNoteEditor nodeId={node.id} note={node.note} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/NoteDrawer/
git commit -m "feat: add resizable NoteDrawer with BlockNote editor"
```

---

## Task 9: Toolbar

**Files:**
- Create: `src/components/Toolbar/Toolbar.tsx`

- [ ] **Step 1: Toolbar 작성**

`src/components/Toolbar/Toolbar.tsx`:
```typescript
import { useMindMapStore, useUndoRedo } from '../../store/useMindMapStore';
import { exportToMarkdown } from '../../utils/exportMarkdown';
import { downloadJson, loadJsonFile } from '../../utils/exportJson';
import { saveAs } from 'file-saver';

export function Toolbar() {
  const {
    mindMapData,
    selectedNodeId,
    addChildNode,
    applyLayout,
    loadFromPersisted,
  } = useMindMapStore();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  const handleExportMarkdown = () => {
    const md = exportToMarkdown(mindMapData);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${mindMapData.title}.md`);
  };

  const handleSaveJson = () => downloadJson(mindMapData);

  const handleLoadJson = async () => {
    try {
      const data = await loadJsonFile();
      loadFromPersisted(data, {});
      // 위치 정보 없이 불러오므로 즉시 레이아웃 재계산
      setTimeout(applyLayout, 50);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0">
      <span className="text-indigo-400 font-semibold text-sm mr-2">🗺 MindMap</span>

      {/* 노드 추가 */}
      <button
        className="px-3 py-1.5 rounded text-xs bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
        disabled={!selectedNodeId}
        onClick={() => selectedNodeId && addChildNode(selectedNodeId, 'text')}
        title="선택 노드에 텍스트 자식 추가"
      >
        + 텍스트
      </button>
      <button
        className="px-3 py-1.5 rounded text-xs bg-indigo-800 text-white hover:bg-indigo-700 disabled:opacity-40"
        disabled={!selectedNodeId}
        onClick={() => selectedNodeId && addChildNode(selectedNodeId, 'table')}
        title="선택 노드에 테이블 자식 추가"
      >
        + 표
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      {/* Undo / Redo */}
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
        disabled={!canUndo}
        onClick={undo}
        title="실행 취소 (Ctrl+Z)"
      >
        ↩ 실행취소
      </button>
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40"
        disabled={!canRedo}
        onClick={redo}
        title="다시 실행 (Ctrl+Y)"
      >
        ↪ 다시하기
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      {/* 레이아웃 재정렬 */}
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={applyLayout}
        title="자동 레이아웃"
      >
        ⟳ 정렬
      </button>

      <div className="flex-1" />

      {/* 내보내기 / 불러오기 */}
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={handleLoadJson}
      >
        📂 열기
      </button>
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={handleSaveJson}
      >
        💾 JSON 저장
      </button>
      <button
        className="px-3 py-1.5 rounded text-xs bg-emerald-700 text-white hover:bg-emerald-600"
        onClick={handleExportMarkdown}
      >
        ↓ MD 내보내기
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Toolbar/Toolbar.tsx
git commit -m "feat: add Toolbar with undo/redo and export actions"
```

---

## Task 10: App 조립 + 자동 저장

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Ctrl+Z / Ctrl+Y 단축키 + 자동 저장 + App 조립**

`src/App.tsx`:
```typescript
import { useEffect, useCallback } from 'react';
import { useMindMapStore, useUndoRedo } from './store/useMindMapStore';
import { saveMindMap, loadMindMap } from './db/mindmapDB';
import { MindMapCanvas } from './components/MindMapCanvas/MindMapCanvas';
import { NoteDrawer } from './components/NoteDrawer/NoteDrawer';
import { Toolbar } from './components/Toolbar/Toolbar';

const MAP_ID = 'default';

// NoteDrawer 초기 너비 복원
const savedWidth = localStorage.getItem('note-panel-width');

export default function App() {
  const { mindMapData, positions, loadFromPersisted, setNoteDrawerWidth } = useMindMapStore();
  const { undo, redo } = useUndoRedo();

  // 앱 시작 시 IndexedDB에서 로드
  useEffect(() => {
    loadMindMap(MAP_ID).then((persisted) => {
      if (persisted) {
        loadFromPersisted(persisted.mindMapData, persisted.positions);
      }
    });
    if (savedWidth) setNoteDrawerWidth(Number(savedWidth));
  }, []);

  // 상태 변경 시 자동 저장 (debounce 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveMindMap(mindMapData, positions);
    }, 500);
    return () => clearTimeout(timer);
  }, [mindMapData, positions]);

  // Ctrl+Z / Ctrl+Y 단축키
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    }
  }, [undo, redo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <MindMapCanvas />
        <NoteDrawer />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: main.tsx 확인**

`src/main.tsx` 내용이 아래와 같은지 확인 (Vite 기본 생성값):
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: 개발 서버 실행 및 기능 확인**

```bash
npm run dev
```

아래 항목 순서대로 브라우저에서 확인:
1. 마인드맵 캔버스에 루트 노드 + 자식 노드 표시됨
2. 노드 더블클릭 → 인라인 편집 가능
3. 노드 호버 → 📝 버튼, ✕ 버튼 표시
4. 📝 클릭 → 오른쪽에서 NoteDrawer 슬라이드 인
5. NoteDrawer 경계 드래그 → 너비 조절 가능
6. Toolbar "+ 텍스트" 버튼 → 선택 노드의 자식 추가됨
7. Ctrl+Z → 추가된 노드 사라짐 (undo 동작)
8. Ctrl+Y → 노드 다시 나타남 (redo 동작)
9. "↓ MD 내보내기" 버튼 → .md 파일 다운로드, 내용 확인
10. 새로고침 후 마인드맵 데이터 유지됨 (IndexedDB 복원)

- [ ] **Step 4: 전체 테스트 실행**

```bash
npx vitest run
```
Expected: 7 tests PASS (layout 3 + exportMarkdown 4)

- [ ] **Step 5: 최종 Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: assemble app with auto-save and keyboard shortcuts"
```

---

## 검증 체크리스트

| 항목 | 확인 방법 |
|------|----------|
| 노드 생성·편집·삭제 | Toolbar 버튼 + 더블클릭 + ✕ 버튼 |
| 베지어 곡선 연결 | 노드 추가 시 S-곡선 연결선 표시 |
| 브랜치 접기/펼치기 | 노드 오른쪽 토글 버튼 |
| NoteDrawer 슬라이드 + 리사이즈 | 📝 버튼 클릭 후 경계 드래그 |
| BlockNote WYSIWYG 편집 | 노트 패널에서 마크다운 입력 시 즉시 렌더링 |
| Undo/Redo | Ctrl+Z / Ctrl+Y 및 Toolbar 버튼 |
| 마크다운 내보내기 | "↓ MD 내보내기" → 파일 열어 구조 확인 |
| JSON 저장·불러오기 | "💾 JSON 저장" → 새로고침 → "📂 열기" |
| 자동 저장 | 편집 후 새로고침 → 상태 유지 |
| 테이블 노드 | "+ 표" 버튼 → 셀 편집 → MD 내보내기에 표 포함 |
