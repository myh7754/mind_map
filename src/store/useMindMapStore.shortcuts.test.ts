import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

/**
 * 키보드 단축키가 의존하는 스토어 액션 회귀 테스트.
 * - addChildNode: 새 id 반환 + index 위치 삽입 + 새 노드 자동 선택
 * - addSiblingNode: nodeId 바로 다음에 형제 추가, 루트는 null
 */
function parentOf(id: string): string | null {
  const { children } = useMindMapStore.getState().mindMapData;
  for (const [pid, kids] of Object.entries(children)) {
    if (kids.includes(id)) return pid;
  }
  return null;
}

describe('노드 생성 단축키 액션', () => {
  beforeEach(() => {
    // root → a, b ; a → a1
    useMindMapStore.temporal.getState().clear();
    useMindMapStore.getState().loadFromPersisted(
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
    useMindMapStore.getState().setSelectedNodeId(null);
    useMindMapStore.getState().applyLayout();
    useMindMapStore.temporal.getState().clear();
  });

  it('addChildNode는 새 id를 반환하고 그 노드를 선택한다', () => {
    const newId = useMindMapStore.getState().addChildNode('a');
    expect(typeof newId).toBe('string');
    expect(parentOf(newId)).toBe('a');
    expect(useMindMapStore.getState().selectedNodeId).toBe(newId);
    // 선택된 노드는 rfNodes에서도 selected=true
    expect(useMindMapStore.getState().rfNodes.find((n) => n.id === newId)?.selected).toBe(true);
  });

  it('addChildNode는 index 위치에 삽입한다', () => {
    // a의 자식 [a1]. index 0에 삽입하면 [new, a1]
    const newId = useMindMapStore.getState().addChildNode('a', 'text', 0);
    expect(useMindMapStore.getState().mindMapData.children.a).toEqual([newId, 'a1']);
  });

  it('addSiblingNode는 nodeId 바로 다음에 형제를 넣는다', () => {
    // root children [a, b]. a의 형제를 만들면 a 다음 → [a, new, b]
    const newId = useMindMapStore.getState().addSiblingNode('a');
    expect(newId).not.toBeNull();
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['a', newId, 'b']);
    expect(parentOf(newId!)).toBe('root');
  });

  it('루트의 형제는 만들 수 없다 (null 반환)', () => {
    const newId = useMindMapStore.getState().addSiblingNode('root');
    expect(newId).toBeNull();
  });

  it('생성은 undo로 되돌릴 수 있다', () => {
    const before = useMindMapStore.getState().mindMapData.children.a.slice();
    useMindMapStore.getState().addChildNode('a');
    expect(useMindMapStore.getState().mindMapData.children.a.length).toBe(before.length + 1);
    useMindMapStore.temporal.getState().undo();
    useMindMapStore.getState().syncRfFromData();
    expect(useMindMapStore.getState().mindMapData.children.a).toEqual(before);
  });

  it('setSelectedNodeId는 rfNodes의 selected 플래그를 갱신한다', () => {
    useMindMapStore.getState().setSelectedNodeId('b');
    const nodes = useMindMapStore.getState().rfNodes;
    expect(nodes.find((n) => n.id === 'b')?.selected).toBe(true);
    expect(nodes.find((n) => n.id === 'a')?.selected).toBe(false);
  });
});
