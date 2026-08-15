import type { MindMapNode, MindMapEdge } from '../types';

// 아직 측정되지 않은(첫 렌더 전) 노드에 쓰는 폴백 크기
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 40;
const RANK_SEP = 80; // 깊이(가로) 간격
const NODE_SEP = 24; // 형제(세로) 간격

interface Size {
  w: number;
  h: number;
}

/**
 * 노드의 실제 렌더 크기. ReactFlow는 렌더 후 measured에 실측치를 채워준다.
 * (표 노드는 높이가 수백 px, 긴 라벨은 폭이 제각각이라 고정값을 쓰면 겹친다)
 */
function measuredSize(node: MindMapNode): Size {
  return {
    w: node.measured?.width ?? node.width ?? DEFAULT_WIDTH,
    h: node.measured?.height ?? node.height ?? DEFAULT_HEIGHT,
  };
}

/**
 * 마인드맵 전용 트리 레이아웃 (LR, 왼→오른쪽).
 *
 * dagre는 같은 rank의 형제 순서를 crossing 최소화 알고리즘으로 재배치하기 때문에
 * children 배열 순서가 화면 세로 순서와 어긋난다 → 드래그 순서 변경이 반영되지 않음.
 * 마인드맵은 항상 트리이므로, children(=edge) 순서를 그대로 위→아래로 배치하는
 * tidy-tree 레이아웃을 직접 구현해 순서를 보장한다.
 *
 * 크기 처리:
 * - 세로: 2패스. ① 각 서브트리가 차지하는 높이(밴드)를 bottom-up 계산
 *   (밴드 = max(자기 높이, 자식 밴드 합 + 간격)) ② 밴드를 위→아래로 나눠주며
 *   각 노드를 자기 밴드의 세로 중앙에 배치. 밴드 중앙이 곧 자식들의 중앙이므로
 *   "부모는 자식 가운데" 규칙이 자동으로 성립한다.
 * - 가로: 깊이별 최대 노드 폭을 누적해 열 x를 정한다 → 넓은 표 노드가 있으면
 *   그 다음 열 전체가 오른쪽으로 밀려 겹치지 않는다.
 */
export function applyTreeLayout(
  nodes: MindMapNode[],
  edges: MindMapEdge[]
): MindMapNode[] {
  const visibleNodes = nodes.filter((n) => !n.hidden);
  const visibleEdges = edges.filter((e) => !e.hidden);

  // edge로부터 부모→자식 맵 구성 (edge 순서 = children 배열 순서 유지)
  const childMap = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const e of visibleEdges) {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
    hasParent.add(e.target);
  }

  // 루트 = 부모가 없는 가시 노드
  const root = visibleNodes.find((n) => !hasParent.has(n.id));
  if (!root) return nodes;

  const sizes = new Map<string, Size>();
  for (const n of visibleNodes) sizes.set(n.id, measuredSize(n));
  const sizeOf = (id: string): Size =>
    sizes.get(id) ?? { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };

  // ── 1패스: 깊이 + 서브트리 밴드 높이 ──
  const depth = new Map<string, number>();
  const band = new Map<string, number>();

  const measure = (id: string, d: number): number => {
    depth.set(id, d);
    const kids = childMap.get(id) ?? [];
    const own = sizeOf(id).h;
    if (kids.length === 0) {
      band.set(id, own);
      return own;
    }
    let childTotal = 0;
    for (let i = 0; i < kids.length; i++) {
      if (i > 0) childTotal += NODE_SEP;
      childTotal += measure(kids[i], d + 1);
    }
    const h = Math.max(own, childTotal);
    band.set(id, h);
    return h;
  };
  measure(root.id, 0);

  // ── 열(x) 좌표: 깊이별 최대 폭 누적 ──
  let maxDepth = 0;
  for (const d of depth.values()) if (d > maxDepth) maxDepth = d;
  const colWidth = new Array<number>(maxDepth + 1).fill(0);
  for (const [id, d] of depth) {
    const w = sizeOf(id).w;
    if (w > colWidth[d]) colWidth[d] = w;
  }
  const colX = new Array<number>(maxDepth + 1).fill(0);
  for (let d = 1; d <= maxDepth; d++) {
    colX[d] = colX[d - 1] + colWidth[d - 1] + RANK_SEP;
  }

  // ── 2패스: 밴드를 나눠주며 배치 ──
  const pos = new Map<string, { x: number; y: number }>();

  const place = (id: string, top: number) => {
    const myBand = band.get(id)!;
    const { h } = sizeOf(id);
    pos.set(id, { x: colX[depth.get(id)!], y: top + (myBand - h) / 2 });

    const kids = childMap.get(id) ?? [];
    if (kids.length === 0) return;

    let childTotal = 0;
    for (let i = 0; i < kids.length; i++) {
      if (i > 0) childTotal += NODE_SEP;
      childTotal += band.get(kids[i])!;
    }
    // 자식 묶음도 부모 밴드의 세로 중앙에 정렬 (부모가 자식보다 클 때 대비)
    let cursor = top + (myBand - childTotal) / 2;
    for (const k of kids) {
      place(k, cursor);
      cursor += band.get(k)! + NODE_SEP;
    }
  };
  place(root.id, 0);

  return nodes.map((node) => {
    if (node.hidden) return node;
    const p = pos.get(node.id);
    return p ? { ...node, position: p } : node;
  });
}
