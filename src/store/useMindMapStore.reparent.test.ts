import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

/**
 * reparentNode 회귀 테스트.
 * - 다른 부모로 이동하면 children 트리가 갱신된다
 * - 순환(자기 후손에 붙이기) / 루트 재배치는 거부된다
 * - 재배치는 undo로 되돌릴 수 있다
 */
function parentOf(id: string): string | null {
  const { children } = useMindMapStore.getState().mindMapData;
  for (const [pid, kids] of Object.entries(children)) {
    if (kids.includes(id)) return pid;
  }
  return null;
}

describe('reparentNode', () => {
  beforeEach(() => {
    // 깨끗한 트리로 초기화: root → a, b ; a → a1
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
    useMindMapStore.getState().applyLayout(); // dagre 배치 적용
    useMindMapStore.temporal.getState().clear();
  });

  it('자식을 다른 부모로 옮기면 부모가 바뀐다', () => {
    expect(parentOf('a1')).toBe('a');
    useMindMapStore.getState().reparentNode('a1', 'b');
    expect(parentOf('a1')).toBe('b');
    // 기존 부모에서는 빠진다
    expect(useMindMapStore.getState().mindMapData.children.a).not.toContain('a1');
    expect(useMindMapStore.getState().mindMapData.children.b).toContain('a1');
  });

  it('자기 후손에게 붙이는 것은 거부된다 (순환 방지)', () => {
    // a 를 자신의 자식 a1 밑으로 옮기려 하면 무시되어야 한다
    useMindMapStore.getState().reparentNode('a', 'a1');
    expect(parentOf('a')).toBe('root'); // 변화 없음
    expect(useMindMapStore.getState().mindMapData.children.a1).not.toContain('a');
  });

  it('루트는 재배치되지 않는다', () => {
    useMindMapStore.getState().reparentNode('root', 'b');
    expect(parentOf('root')).toBe(null);
  });

  it('이미 같은 부모면 변화 없음', () => {
    const before = useMindMapStore.getState().mindMapData.children.a.slice();
    useMindMapStore.getState().reparentNode('a1', 'a');
    expect(useMindMapStore.getState().mindMapData.children.a).toEqual(before);
  });

  it('재배치는 undo로 되돌릴 수 있다', () => {
    useMindMapStore.getState().reparentNode('a1', 'b');
    expect(parentOf('a1')).toBe('b');
    useMindMapStore.temporal.getState().undo();
    useMindMapStore.getState().syncRfFromData();
    expect(parentOf('a1')).toBe('a');
  });

  it('moveNode 인덱스로 같은 부모 안에서 순서를 바꾼다', () => {
    // root children: [a, b]. b를 0번 위치로 옮기면 [b, a]
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['a', 'b']);
    useMindMapStore.getState().moveNode('b', 'root', 0);
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['b', 'a']);
  });

  it('moveNode로 다른 부모의 특정 위치에 삽입한다', () => {
    // root에 자식 c 추가용으로 a1을 root의 0번에 삽입 → [a1, a, b]
    useMindMapStore.getState().moveNode('a1', 'root', 0);
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['a1', 'a', 'b']);
    expect(parentOf('a1')).toBe('root');
    expect(useMindMapStore.getState().mindMapData.children.a).not.toContain('a1');
  });

  it('순서 변경도 undo로 되돌릴 수 있다', () => {
    useMindMapStore.getState().moveNode('b', 'root', 0);
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['b', 'a']);
    useMindMapStore.temporal.getState().undo();
    useMindMapStore.getState().syncRfFromData();
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['a', 'b']);
  });

  it('children 배열 순서가 화면 세로(y) 순서와 일치한다 (reorder가 실제로 반영됨)', () => {
    const yOf = (id: string) =>
      useMindMapStore.getState().rfNodes.find((n) => n.id === id)!.position.y;
    // 초기: root children [a, b] → a 가 b 보다 위
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['a', 'b']);
    expect(yOf('a')).toBeLessThan(yOf('b'));
    // b 를 0번으로 → [b, a] → 이제 b 가 a 보다 위에 와야 한다
    useMindMapStore.getState().moveNode('b', 'root', 0);
    expect(useMindMapStore.getState().mindMapData.children.root).toEqual(['b', 'a']);
    expect(yOf('b')).toBeLessThan(yOf('a'));
  });

  it('노드를 옮기면 그 자식(서브트리)도 함께 따라온다', () => {
    // a 는 자식 a1 을 가짐. a 를 b 밑으로 옮겨도 a1 은 여전히 a 의 자식
    useMindMapStore.getState().moveNode('a', 'b', 0);
    expect(parentOf('a')).toBe('b');
    expect(useMindMapStore.getState().mindMapData.children.a).toContain('a1');
    expect(parentOf('a1')).toBe('a');
    // a1 노드 데이터도 그대로 존재
    expect(useMindMapStore.getState().mindMapData.nodes.a1).toBeDefined();
  });
});
