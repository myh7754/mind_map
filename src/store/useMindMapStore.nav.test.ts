import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

/**
 * 방향키 탐색(selectRelative)과 노드 드러내기(revealNode) 회귀 테스트.
 * 트리: root → a, b ; a → a1, a2
 */
const selected = () => useMindMapStore.getState().selectedNodeId;

describe('selectRelative / revealNode', () => {
  beforeEach(() => {
    useMindMapStore.temporal.getState().clear();
    useMindMapStore.getState().loadFromPersisted(
      {
        id: 'test',
        title: 't',
        rootId: 'root',
        children: { root: ['a', 'b'], a: ['a1', 'a2'], b: [], a1: [], a2: [] },
        nodes: {
          root: { id: 'root', type: 'text', label: 'root', note: '', collapsed: false },
          a: { id: 'a', type: 'text', label: 'a', note: '', collapsed: false },
          b: { id: 'b', type: 'text', label: 'b', note: '', collapsed: false },
          a1: { id: 'a1', type: 'text', label: 'a1', note: '', collapsed: false },
          a2: { id: 'a2', type: 'text', label: 'a2', note: '', collapsed: false },
        },
      },
      {}
    );
    useMindMapStore.getState().setSelectedNodeId(null);
    useMindMapStore.getState().applyLayout();
    useMindMapStore.temporal.getState().clear();
  });

  it('선택이 없으면 루트가 선택된다', () => {
    useMindMapStore.getState().selectRelative('down');
    expect(selected()).toBe('root');
  });

  it('오른쪽은 첫 자식으로 이동한다', () => {
    useMindMapStore.getState().setSelectedNodeId('root');
    useMindMapStore.getState().selectRelative('right');
    expect(selected()).toBe('a');
  });

  it('왼쪽은 부모로 이동한다', () => {
    useMindMapStore.getState().setSelectedNodeId('a1');
    useMindMapStore.getState().selectRelative('left');
    expect(selected()).toBe('a');
  });

  it('위/아래는 형제 사이를 이동한다', () => {
    useMindMapStore.getState().setSelectedNodeId('a1');
    useMindMapStore.getState().selectRelative('down');
    expect(selected()).toBe('a2');
    useMindMapStore.getState().selectRelative('up');
    expect(selected()).toBe('a1');
  });

  it('형제의 끝에서는 더 이동하지 않는다', () => {
    useMindMapStore.getState().setSelectedNodeId('a2');
    useMindMapStore.getState().selectRelative('down');
    expect(selected()).toBe('a2');
  });

  it('잎 노드에서 오른쪽은 아무 일도 하지 않는다', () => {
    useMindMapStore.getState().setSelectedNodeId('b');
    useMindMapStore.getState().selectRelative('right');
    expect(selected()).toBe('b');
  });

  it('루트에서 왼쪽/위아래는 아무 일도 하지 않는다', () => {
    useMindMapStore.getState().setSelectedNodeId('root');
    useMindMapStore.getState().selectRelative('left');
    expect(selected()).toBe('root');
    useMindMapStore.getState().selectRelative('down');
    expect(selected()).toBe('root');
  });

  it('접힌 노드에서 오른쪽을 누르면 펼쳐지고 첫 자식이 선택된다', () => {
    useMindMapStore.getState().toggleCollapse('a');
    expect(useMindMapStore.getState().mindMapData.nodes.a.collapsed).toBe(true);

    useMindMapStore.getState().setSelectedNodeId('a');
    useMindMapStore.getState().selectRelative('right');

    expect(useMindMapStore.getState().mindMapData.nodes.a.collapsed).toBe(false);
    expect(selected()).toBe('a1');
  });

  it('revealNode는 접힌 조상을 모두 펼친다', () => {
    useMindMapStore.getState().toggleCollapse('a');
    // a가 접혔으므로 a1은 화면에서 숨겨진 상태
    expect(useMindMapStore.getState().rfNodes.find((n) => n.id === 'a1')?.hidden).toBe(true);

    useMindMapStore.getState().revealNode('a1');

    expect(useMindMapStore.getState().mindMapData.nodes.a.collapsed).toBe(false);
    expect(useMindMapStore.getState().rfNodes.find((n) => n.id === 'a1')?.hidden).toBe(false);
  });

  it('focusNode는 같은 노드를 연속 요청해도 seq가 증가한다', () => {
    useMindMapStore.getState().focusNode('a');
    const first = useMindMapStore.getState().focusRequest!;
    useMindMapStore.getState().focusNode('a');
    const second = useMindMapStore.getState().focusRequest!;
    expect(second.id).toBe('a');
    expect(second.seq).toBeGreaterThan(first.seq);
  });
});
