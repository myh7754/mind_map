import { describe, it, expect } from 'vitest';
import { applyTreeLayout } from './layout';
import type { MindMapNode, MindMapEdge } from '../types';

const makeNode = (id: string, measured?: { width: number; height: number }): MindMapNode => ({
  id,
  type: 'textNode',
  position: { x: 0, y: 0 },
  data: { id, type: 'text', label: id, note: '', collapsed: false },
  ...(measured ? { measured } : {}),
});

// 노드의 세로 점유 구간 [top, bottom)
const vSpan = (nodes: MindMapNode[], id: string) => {
  const n = nodes.find((x) => x.id === id)!;
  const h = n.measured?.height ?? 40;
  return { top: n.position.y, bottom: n.position.y + h };
};

const makeEdge = (source: string, target: string): MindMapEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  data: { depth: 0 },
});

describe('applyTreeLayout', () => {
  it('should assign different positions to root and child nodes', () => {
    const nodes = [makeNode('root'), makeNode('child')];
    const edges = [makeEdge('root', 'child')];
    const result = applyTreeLayout(nodes, edges);
    const root = result.find((n) => n.id === 'root')!;
    const child = result.find((n) => n.id === 'child')!;
    expect(root.position).not.toEqual(child.position);
  });

  it('should place root to the left of child (LR direction)', () => {
    const nodes = [makeNode('root'), makeNode('child')];
    const edges = [makeEdge('root', 'child')];
    const result = applyTreeLayout(nodes, edges);
    const root = result.find((n) => n.id === 'root')!;
    const child = result.find((n) => n.id === 'child')!;
    expect(root.position.x).toBeLessThan(child.position.x);
  });

  it('should not change position of hidden nodes', () => {
    const hiddenNode: MindMapNode = { ...makeNode('hidden'), hidden: true };
    const nodes = [makeNode('root'), hiddenNode];
    const edges: MindMapEdge[] = [];
    const result = applyTreeLayout(nodes, edges);
    const hidden = result.find((n) => n.id === 'hidden')!;
    expect(hidden.position).toEqual({ x: 0, y: 0 });
  });

  it('키 큰 형제(표 노드)가 있어도 형제끼리 겹치지 않는다', () => {
    // tall은 표 노드처럼 높이 300px. 고정 높이(40) 가정이면 아래 형제와 겹친다.
    const nodes = [
      makeNode('root'),
      makeNode('a', { width: 160, height: 40 }),
      makeNode('tall', { width: 200, height: 300 }),
      makeNode('c', { width: 160, height: 40 }),
    ];
    const edges = [makeEdge('root', 'a'), makeEdge('root', 'tall'), makeEdge('root', 'c')];
    const result = applyTreeLayout(nodes, edges);

    const a = vSpan(result, 'a');
    const tall = vSpan(result, 'tall');
    const c = vSpan(result, 'c');
    expect(a.bottom).toBeLessThanOrEqual(tall.top);
    expect(tall.bottom).toBeLessThanOrEqual(c.top);
  });

  it('넓은 노드가 있으면 다음 깊이의 열이 그만큼 오른쪽으로 밀린다', () => {
    const nodes = [
      makeNode('root', { width: 400, height: 40 }), // 아주 넓은 루트
      makeNode('child', { width: 160, height: 40 }),
    ];
    const edges = [makeEdge('root', 'child')];
    const result = applyTreeLayout(nodes, edges);
    const root = result.find((n) => n.id === 'root')!;
    const child = result.find((n) => n.id === 'child')!;
    // 자식은 루트의 오른쪽 끝(400)보다 더 오른쪽에 있어야 겹치지 않는다
    expect(child.position.x).toBeGreaterThanOrEqual(root.position.x + 400);
  });

  it('부모는 자식들의 세로 중앙에 놓인다', () => {
    const nodes = [
      makeNode('root', { width: 160, height: 40 }),
      makeNode('a', { width: 160, height: 40 }),
      makeNode('b', { width: 160, height: 40 }),
    ];
    const edges = [makeEdge('root', 'a'), makeEdge('root', 'b')];
    const result = applyTreeLayout(nodes, edges);
    const centerY = (id: string) => {
      const s = vSpan(result, id);
      return (s.top + s.bottom) / 2;
    };
    expect(centerY('root')).toBeCloseTo((centerY('a') + centerY('b')) / 2, 5);
  });

  it('서브트리가 큰 형제는 그만큼 세로 공간을 더 차지한다', () => {
    // root → big(자식 3개), small(자식 없음). big의 서브트리가 크므로
    // small은 big의 자식들과 겹치지 않는 위치로 밀려나야 한다.
    const nodes = [
      makeNode('root', { width: 160, height: 40 }),
      makeNode('big', { width: 160, height: 40 }),
      makeNode('b1', { width: 160, height: 40 }),
      makeNode('b2', { width: 160, height: 40 }),
      makeNode('b3', { width: 160, height: 40 }),
      makeNode('small', { width: 160, height: 40 }),
    ];
    const edges = [
      makeEdge('root', 'big'),
      makeEdge('root', 'small'),
      makeEdge('big', 'b1'),
      makeEdge('big', 'b2'),
      makeEdge('big', 'b3'),
    ];
    const result = applyTreeLayout(nodes, edges);
    // big의 자식들이 모두 small 보다 위에 있어야 한다 (세로 영역 침범 없음)
    for (const id of ['b1', 'b2', 'b3']) {
      expect(vSpan(result, id).bottom).toBeLessThanOrEqual(vSpan(result, 'small').top);
    }
  });
});
