import type { MindMapNode, MindMapEdge } from '../types';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 40;
const RANK_SEP = 80; // 깊이(가로) 간격
const NODE_SEP = 24; // 형제(세로) 간격
const X_STEP = NODE_WIDTH + RANK_SEP;
const Y_STEP = NODE_HEIGHT + NODE_SEP;

/**
 * 마인드맵 전용 트리 레이아웃 (LR, 왼→오른쪽).
 *
 * dagre는 같은 rank의 형제 순서를 crossing 최소화 알고리즘으로 재배치하기 때문에
 * children 배열 순서가 화면 세로 순서와 어긋난다 → 드래그 순서 변경이 반영되지 않음.
 * 마인드맵은 항상 트리이므로, 여기서는 children(=edge) 순서를 그대로 위→아래로
 * 배치하는 단순 tidy-tree 레이아웃을 직접 구현해 순서를 보장한다.
 *
 * (export 이름은 기존 호출부 호환을 위해 유지)
 */
export function applyDagreLayout(
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

  const pos = new Map<string, { x: number; y: number }>();
  let nextY = 0;

  const layout = (id: string, depth: number) => {
    const kids = childMap.get(id) ?? [];
    const x = depth * X_STEP;
    if (kids.length === 0) {
      // 잎: 순서대로 세로 슬롯 차지
      pos.set(id, { x, y: nextY });
      nextY += Y_STEP;
      return;
    }
    for (const k of kids) layout(k, depth + 1);
    // 부모는 자식들의 가운데에 위치
    const firstY = pos.get(kids[0])!.y;
    const lastY = pos.get(kids[kids.length - 1])!.y;
    pos.set(id, { x, y: (firstY + lastY) / 2 });
  };

  if (root) layout(root.id, 0);

  return nodes.map((node) => {
    if (node.hidden) return node;
    const p = pos.get(node.id);
    return p ? { ...node, position: p } : node;
  });
}
