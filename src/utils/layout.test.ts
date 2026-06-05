import { describe, it, expect } from 'vitest';
import { applyTreeLayout } from './layout';
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
});
