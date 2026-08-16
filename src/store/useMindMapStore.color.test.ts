import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

const store = () => useMindMapStore.getState();
const colorOf = (id: string) => store().mindMapData.nodes[id]?.style?.color;
const edgeColor = (source: string, target: string) =>
  store().rfEdges.find((e) => e.source === source && e.target === target)?.data?.color;

describe('setNodeColor', () => {
  beforeEach(() => {
    useMindMapStore.temporal.getState().clear();
    // root → a, b ; a → a1
    store().loadFromPersisted(
      {
        id: 'test',
        title: 't',
        rootId: 'root',
        children: { root: ['a', 'b'], a: ['a1'], b: [], a1: [] },
        nodes: {
          root: { id: 'root', type: 'text', label: 'root', note: '', collapsed: false },
          a: { id: 'a', type: 'text', label: 'a', note: '', collapsed: false },
          b: { id: 'b', type: 'text', label: 'b', note: '', collapsed: false },
          a1: { id: 'a1', type: 'text', label: 'a1', note: '', collapsed: false },
        },
      },
      {}
    );
    store().applyLayout();
    useMindMapStore.temporal.getState().clear();
  });

  it('노드 하나만 칠한다', () => {
    store().setNodeColor('a', '#1d4ed8');

    expect(colorOf('a')).toBe('#1d4ed8');
    expect(colorOf('a1')).toBeUndefined(); // 자식은 그대로
    expect(colorOf('b')).toBeUndefined();
  });

  it('가지 전체를 칠하면 후손까지 따라간다', () => {
    store().setNodeColor('a', '#047857', true);

    expect(colorOf('a')).toBe('#047857');
    expect(colorOf('a1')).toBe('#047857');
    expect(colorOf('b')).toBeUndefined(); // 다른 가지는 건드리지 않는다
  });

  it('null이면 기본색으로 되돌린다', () => {
    store().setNodeColor('a', '#047857', true);
    store().setNodeColor('a', null, true);

    expect(colorOf('a')).toBeUndefined();
    expect(colorOf('a1')).toBeUndefined();
  });

  it('간선 색이 자식 노드 색을 따라간다', () => {
    expect(edgeColor('root', 'a')).toBeUndefined();

    store().setNodeColor('a', '#be185d');

    expect(edgeColor('root', 'a')).toBe('#be185d');
    expect(edgeColor('root', 'b')).toBeUndefined();
  });

  it('없는 노드는 무시한다', () => {
    const before = store().mindMapData;
    store().setNodeColor('없음', '#fff');
    expect(store().mindMapData).toBe(before);
  });

  it('색 변경은 undo로 되돌릴 수 있다', () => {
    store().setNodeColor('a', '#1d4ed8');
    expect(colorOf('a')).toBe('#1d4ed8');

    useMindMapStore.temporal.getState().undo();
    store().syncRfFromData();

    expect(colorOf('a')).toBeUndefined();
  });

  it('색만 바꿀 때는 위치가 유지된다 (재배치하지 않음)', () => {
    const before = store().positions;
    store().setNodeColor('a', '#1d4ed8', true);
    expect(store().positions).toBe(before);
  });
});
