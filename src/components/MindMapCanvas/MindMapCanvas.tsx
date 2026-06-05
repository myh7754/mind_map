import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  ViewportPortal,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '../../store/useMindMapStore';
import type { MindMapEdge } from '../../types';
import { TextNode } from './TextNode';
import { TableNode } from './TableNode';
import { BezierEdge } from './BezierEdge';
import { ChordPanController } from './ChordPanController';

const nodeTypes: NodeTypes = {
  textNode: TextNode,
  tableNode: TableNode,
};

const edgeTypes: EdgeTypes = {
  bezierEdge: BezierEdge,
};

const SLOT_GAP = 12; // 슬롯 위/아래 여백(px)

// children 맵에서 nodeId의 부모를 찾는다. 없으면 null(루트).
function findParentId(nodeId: string, children: Record<string, string[]>): string | null {
  for (const [pid, kids] of Object.entries(children)) {
    if (kids.includes(nodeId)) return pid;
  }
  return null;
}

type Drop = { parentId: string; index: number };

function Flow() {
  const {
    rfNodes,
    rfEdges,
    onRfNodesChange,
    onRfEdgesChange,
    setSelectedNodeId,
    deleteNodes,
    moveNode,
    syncRfFromData,
    mindMapData,
  } = useMindMapStore();
  const { getNodes } = useReactFlow();

  // 드래그 중인 노드 + 드롭 결정(부모/삽입 인덱스). 렌더(슬롯·간선)에 사용.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  // 드래그되는 노드의 후손 집합 (새 부모 후보에서 제외해 순환 방지)
  const subtreeRef = useRef<Set<string>>(new Set());
  // 드래그 시작 시점의 노드 위치/크기 스냅샷. 드래그 중 형제가 시각적으로 밀려나도
  // 인덱스 계산은 이 고정 스냅샷을 써서 흔들리지 않게 한다.
  const rectsRef = useRef<Map<string, { x: number; y: number; w: number; h: number; cy: number }>>(new Map());
  // stop 시점에 적용할 최신 드롭 결정 (state는 클로저에서 stale할 수 있어 ref 병행)
  const dropRef = useRef<Drop | null>(null);

  const handleNodesDelete = (deleted: Node[]) => {
    deleteNodes(deleted.map((n) => n.id));
  };

  // 드래그 노드를 어디에(부모) 몇 번째(index)로 놓을지 계산한다.
  // - 대상 노드의 "오른쪽"으로 가면 그 노드의 자식
  // - 옆/위아래면 그 노드의 형제 (같은 부모, y위치로 순서 결정)
  // 위치는 드래그 시작 시 캡처한 스냅샷(rectsRef)을 쓰고, 드래그 노드만 실시간 위치 사용.
  const computeDrop = useCallback(
    (node: Node): Drop | null => {
      const { rootId, children } = mindMapData;
      if (node.id === rootId) return null;

      const rects = rectsRef.current;
      const dn = rects.get(node.id);
      const dw = dn?.w ?? 160;
      const dh = dn?.h ?? 40;
      const a = { x: node.position.x, y: node.position.y, w: dw, h: dh, cy: node.position.y + dh / 2 };

      // 가장 가까운 노드(자신/후손 제외)를 사각형 간격으로 찾는다
      let nearest: string | null = null;
      let bestGap = Infinity;
      for (const [id, r] of rects) {
        if (id === node.id || subtreeRef.current.has(id)) continue;
        const dx = Math.max(0, a.x - (r.x + r.w), r.x - (a.x + a.w));
        const dy = Math.max(0, a.y - (r.y + r.h), r.y - (a.y + a.h));
        const gap = Math.hypot(dx, dy);
        if (gap < bestGap) { bestGap = gap; nearest = id; }
      }
      const PROXIMITY = 90; // 이 거리(px) 안이면 후보 (살짝 떨어져도 OK)
      if (!nearest || bestGap > PROXIMITY) return null;

      // sibs(자신 제외) 중 드롭 y위치에 맞는 삽입 인덱스
      const indexByY = (sibs: string[]) => {
        for (let i = 0; i < sibs.length; i++) {
          const r = rects.get(sibs[i]);
          if (r && a.cy < r.cy) return i;
        }
        return sibs.length;
      };

      const nr = rects.get(nearest)!;
      // 자식/형제 판정은 "왼쪽 정렬 x" 기준 (폭이 달라도 같은 열은 x가 같아 안정적).
      // 드래그 노드 왼쪽이 대상 가로 중앙을 넘으면 → 자식, 아니면 → 형제.
      const isChildDrop = nearest === rootId || a.x > nr.x + nr.w * 0.5;

      if (isChildDrop) {
        const sibs = (children[nearest] ?? []).filter((id) => id !== node.id);
        return { parentId: nearest, index: indexByY(sibs) };
      }
      const np = findParentId(nearest, children);
      if (np === null || subtreeRef.current.has(np)) {
        // 대상이 루트(부모 없음)이거나 순환이면 대상의 자식으로 처리
        const sibs = (children[nearest] ?? []).filter((id) => id !== node.id);
        return { parentId: nearest, index: indexByY(sibs) };
      }
      const sibs = (children[np] ?? []).filter((id) => id !== node.id);
      return { parentId: np, index: indexByY(sibs) };
    },
    [mindMapData]
  );

  const onNodeDragStart = useCallback(
    (_: unknown, node: Node) => {
      const { rootId, children } = mindMapData;
      if (node.id === rootId) return; // 루트는 재배치 불가
      // 자기 자신 + 후손 모음 (서브트리는 통째로 따라 움직이며, 후보에서 제외해 순환 방지)
      const subtree = new Set<string>();
      const queue = [node.id];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        subtree.add(cur);
        for (const c of children[cur] ?? []) queue.push(c);
      }
      subtreeRef.current = subtree;
      // 위치/크기 스냅샷 캡처 (드래그 동안 고정 기준으로 사용)
      const snap = new Map<string, { x: number; y: number; w: number; h: number; cy: number }>();
      for (const n of getNodes()) {
        const w = n.measured?.width ?? n.width ?? 160;
        const h = n.measured?.height ?? n.height ?? 40;
        snap.set(n.id, { x: n.position.x, y: n.position.y, w, h, cy: n.position.y + h / 2 });
      }
      rectsRef.current = snap;
      setDraggingId(node.id);
    },
    [mindMapData, getNodes]
  );

  const onNodeDrag = useCallback(
    (_: unknown, node: Node) => {
      const d = computeDrop(node);
      dropRef.current = d;
      setDrop(d);
    },
    [computeDrop]
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const d = dropRef.current;
      setDraggingId(null);
      setDrop(null);
      dropRef.current = null;
      if (d) {
        moveNode(node.id, d.parentId, d.index); // 부모/순서 변경 + 자동 재정렬 (자식도 함께 이동)
      }
      // 모든 경우에 격자로 스냅백 (자유 위치로 멈추지 않음)
      syncRfFromData();
    },
    [moveNode, syncRfFromData]
  );

  // 드래그 중: 끄는 노드는 반투명, index 이후 형제는 아래로 밀어 슬롯 공간 확보.
  // (노드 개수는 그대로 두고 위치/클래스만 override → ReactFlow 드래그와 충돌 없음)
  const nodes = useMemo<Node[]>(() => {
    if (!draggingId || !drop) return rfNodes;
    const byId = new Map(rfNodes.map((n) => [n.id, n]));
    const dragged = byId.get(draggingId);
    const gh = dragged?.measured?.height ?? dragged?.height ?? 40;
    const shift = gh + SLOT_GAP;
    const sibIds = (mindMapData.children[drop.parentId] ?? []).filter((id) => id !== draggingId);
    const shiftSet = new Set(sibIds.slice(drop.index));
    return rfNodes.map((n) => {
      if (n.id === draggingId) return { ...n, className: 'rf-dragging' };
      if (shiftSet.has(n.id)) {
        return { ...n, position: { x: n.position.x, y: n.position.y + shift } };
      }
      return n;
    });
  }, [rfNodes, draggingId, drop, mindMapData.children]);

  // 드래그 중: 끄는 노드의 기존 들어오는 간선만 숨긴다 (미리보기는 오버레이로 따로 그림)
  const edges = useMemo<MindMapEdge[]>(() => {
    if (!draggingId || !drop) return rfEdges;
    return rfEdges.filter((e) => e.target !== draggingId);
  }, [rfEdges, draggingId, drop]);

  // 정렬된 미리보기 기하: 슬롯 박스 위치/크기 + 부모→슬롯 베지어 경로 (flow 좌표)
  const preview = useMemo(() => {
    if (!draggingId || !drop) return null;
    const byId = new Map(rfNodes.map((n) => [n.id, n]));
    const dragged = byId.get(draggingId);
    const parent = byId.get(drop.parentId);
    if (!parent) return null;
    const gw = dragged?.measured?.width ?? dragged?.width ?? 140;
    const gh = dragged?.measured?.height ?? dragged?.height ?? 40;
    const pw = parent.measured?.width ?? parent.width ?? 160;
    const ph = parent.measured?.height ?? parent.height ?? 40;

    const sibs = (mindMapData.children[drop.parentId] ?? [])
      .filter((id) => id !== draggingId)
      .map((id) => byId.get(id))
      .filter(Boolean) as Node[];

    let slotX: number;
    let slotY: number;
    if (sibs.length === 0) {
      slotX = parent.position.x + pw + 80;
      slotY = parent.position.y;
    } else {
      slotX = sibs[0].position.x; // 형제들은 같은 열(x) 공유
      if (drop.index >= sibs.length) {
        const last = sibs[sibs.length - 1];
        slotY = last.position.y + (last.measured?.height ?? 40) + SLOT_GAP;
      } else {
        slotY = sibs[drop.index].position.y;
      }
    }

    const sx = parent.position.x + pw;
    const sy = parent.position.y + ph / 2;
    const tx = slotX;
    const ty = slotY + gh / 2;
    const mx = (sx + tx) / 2;
    const path = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
    return { slotX, slotY, gw, gh, path };
  }, [rfNodes, draggingId, drop, mindMapData.children]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onRfNodesChange}
      onEdgesChange={onRfEdgesChange}
      onNodeClick={(_, node) => setSelectedNodeId(node.id)}
      onPaneClick={() => setSelectedNodeId(null)}
      onNodesDelete={handleNodesDelete}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.2}
      maxZoom={2}
      /* 노드 드래그 허용: 끌어서 다른 부모에 재배치. 놓으면 자동 정렬로 스냅백 */
      nodesDraggable
      /* 좌클릭 드래그(빈 곳) = 박스 선택 (여러 노드 선택) */
      selectionOnDrag
      selectionMode={SelectionMode.Partial}
      selectionKeyCode={null}
      /* 네이티브 단일버튼 팬은 끔. 화면 이동은 좌+우 동시 드래그(ChordPanController)로 처리 */
      panOnDrag={false}
      /* Delete/Backspace로 선택된 노드 삭제 */
      deleteKeyCode={['Delete', 'Backspace']}
    >
      <ChordPanController />
      {preview && (
        <ViewportPortal>
          {/* 정렬된 슬롯 자리표시 */}
          <div
            style={{
              position: 'absolute',
              left: preview.slotX,
              top: preview.slotY,
              width: preview.gw,
              height: preview.gh,
              border: '2px dashed #f59e0b',
              borderRadius: 8,
              background: 'rgba(245,158,11,0.15)',
              pointerEvents: 'none',
            }}
          />
          {/* 부모 → 슬롯 정렬된 미리보기 간선 */}
          <svg
            style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none' }}
          >
            <path d={preview.path} stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="6 4" fill="none" strokeLinecap="round" />
          </svg>
        </ViewportPortal>
      )}
      <Background color="#334155" gap={20} size={1} />
      <Controls />
      <MiniMap nodeColor="#334155" maskColor="rgba(15,23,42,0.7)" />
    </ReactFlow>
  );
}

export function MindMapCanvas() {
  return (
    <div className="flex-1 h-full bg-slate-950">
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
