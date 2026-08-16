import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

/**
 * 모두 펼치기 / 모두 접기.
 * 트리: root → a, b ; a → a1, a2   (자식이 있는 건 root 와 a 뿐)
 */
const nodes = () => useMindMapStore.getState().mindMapData.nodes;
const collapsedIds = () =>
  Object.values(nodes())
    .filter((n) => n.collapsed)
    .map((n) => n.id)
    .sort();

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
  useMindMapStore.getState().applyLayout();
});

describe('setAllCollapsed', () => {
  it('모두 접으면 자식 있는 노드만 접힌다', () => {
    useMindMapStore.getState().setAllCollapsed(true);
    // a 만. root 는 제외, 잎(b/a1/a2)은 접을 게 없다
    expect(collapsedIds()).toEqual(['a']);
  });

  it('루트는 접지 않는다 — 접으면 맵이 사라진 것처럼 보인다', () => {
    useMindMapStore.getState().setAllCollapsed(true);
    expect(nodes().root.collapsed).toBe(false);
  });

  it('모두 펼치면 접힌 게 하나도 남지 않는다', () => {
    useMindMapStore.getState().setAllCollapsed(true);
    useMindMapStore.getState().setAllCollapsed(false);
    expect(collapsedIds()).toEqual([]);
  });

  it('접힌 노드의 후손은 화면에서 빠진다', () => {
    useMindMapStore.getState().setAllCollapsed(true);
    const visible = useMindMapStore
      .getState()
      .rfNodes.filter((n) => !n.hidden)
      .map((n) => n.id)
      .sort();
    expect(visible).toEqual(['a', 'b', 'root']); // a1, a2 는 a 안에 숨음
  });

  it('화면을 맞춰달라고 요청한다', () => {
    const before = useMindMapStore.getState().fitRequest;
    useMindMapStore.getState().setAllCollapsed(true);
    expect(useMindMapStore.getState().fitRequest).toBe(before + 1);
  });

  it('바뀔 게 없으면 아무 일도 하지 않는다 (헛된 재배치·fitView 방지)', () => {
    const before = useMindMapStore.getState().fitRequest;
    useMindMapStore.getState().setAllCollapsed(false); // 이미 전부 펼쳐진 상태
    expect(useMindMapStore.getState().fitRequest).toBe(before);
  });
});

describe('toggleCollapse', () => {
  it('접었다 펴면 원래대로 돌아온다', () => {
    useMindMapStore.getState().toggleCollapse('a');
    expect(nodes().a.collapsed).toBe(true);
    useMindMapStore.getState().toggleCollapse('a');
    expect(nodes().a.collapsed).toBe(false);
  });

  it('누른 노드를 따라가도록 focus 를 요청한다 (재배치로 화면 밖으로 밀리는 경우 대비)', () => {
    useMindMapStore.getState().toggleCollapse('a');
    const req = useMindMapStore.getState().focusRequest;
    expect(req?.id).toBe('a');
    expect(req?.center).toBe(false); // 화면 안에 있으면 움직이지 않아야 한다
  });
});

describe('openMap', () => {
  it('맵을 열면 화면 맞춤을 요청한다 (이전 맵의 배율이 남지 않게)', () => {
    const before = useMindMapStore.getState().fitRequest;
    useMindMapStore.getState().openMap(
      {
        id: 'other',
        title: '다른 맵',
        rootId: 'r',
        children: { r: [] },
        nodes: { r: { id: 'r', type: 'text', label: 'r', note: '', collapsed: false } },
      },
      {}
    );
    expect(useMindMapStore.getState().fitRequest).toBe(before + 1);
  });
});
