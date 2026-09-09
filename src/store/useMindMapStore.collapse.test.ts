import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

/**
 * 모두 펼치기 / 모두 접기 / 단계별 펼치기.
 * 트리: root → a, b ; a → a1, a2 ; a1 → a1x
 * 깊이:  root=0 · a,b=1 · a1,a2=2 · a1x=3
 * 자식이 있는 건 root, a, a1 셋.
 */
const nodes = () => useMindMapStore.getState().mindMapData.nodes;
const collapsedIds = () =>
  Object.values(nodes())
    .filter((n) => n.collapsed)
    .map((n) => n.id)
    .sort();

/** 화면에 실제로 그려지는 노드 (접힌 조상 때문에 숨은 것 제외) */
const visibleIds = () =>
  useMindMapStore
    .getState()
    .rfNodes.filter((n) => !n.hidden)
    .map((n) => n.id)
    .sort();

beforeEach(() => {
  useMindMapStore.temporal.getState().clear();
  useMindMapStore.getState().loadFromPersisted(
    {
      id: 'test',
      title: 't',
      rootId: 'root',
      children: { root: ['a', 'b'], a: ['a1', 'a2'], b: [], a1: ['a1x'], a2: [], a1x: [] },
      nodes: {
        root: { id: 'root', type: 'text', label: 'root', note: '', collapsed: false },
        a: { id: 'a', type: 'text', label: 'a', note: '', collapsed: false },
        b: { id: 'b', type: 'text', label: 'b', note: '', collapsed: false },
        a1: { id: 'a1', type: 'text', label: 'a1', note: '', collapsed: false },
        a2: { id: 'a2', type: 'text', label: 'a2', note: '', collapsed: false },
        a1x: { id: 'a1x', type: 'text', label: 'a1x', note: '', collapsed: false },
      },
    },
    {}
  );
  useMindMapStore.getState().applyLayout();
});

describe('expandToLevel', () => {
  it('1단계 = 루트와 그 자식까지만 보인다', () => {
    useMindMapStore.getState().expandToLevel(1);
    expect(visibleIds()).toEqual(['a', 'b', 'root']);
  });

  it('2단계 = 손자까지 보인다', () => {
    useMindMapStore.getState().expandToLevel(2);
    expect(visibleIds()).toEqual(['a', 'a1', 'a2', 'b', 'root']);
  });

  it('깊이가 부족하면 트리 전체가 펼쳐진다 (접힌 게 남지 않는다)', () => {
    useMindMapStore.getState().setAllCollapsed(true);
    useMindMapStore.getState().expandToLevel(9);
    expect(collapsedIds()).toEqual([]);
  });

  it('이미 접혀 있던 것도 단계에 맞게 다시 펼친다', () => {
    useMindMapStore.getState().setAllCollapsed(true); // a, a1 접힘
    useMindMapStore.getState().expandToLevel(2);
    // a는 깊이1이라 펼쳐지고, a1은 깊이2라 접힌 채로
    expect(nodes().a.collapsed).toBe(false);
    expect(nodes().a1.collapsed).toBe(true);
  });

  it('잎 노드는 접지 않는다 (접을 자식이 없다)', () => {
    useMindMapStore.getState().expandToLevel(1);
    expect(nodes().b.collapsed).toBe(false);
    expect(nodes().a1x.collapsed).toBe(false);
  });

  it('화면을 맞춰달라고 요청한다', () => {
    const before = useMindMapStore.getState().fitRequest;
    useMindMapStore.getState().expandToLevel(1);
    expect(useMindMapStore.getState().fitRequest).toBe(before + 1);
  });
});

describe('setAllCollapsed', () => {
  it('모두 접으면 자식 있는 노드만 접힌다', () => {
    useMindMapStore.getState().setAllCollapsed(true);
    // a, a1 만. root 는 제외, 잎(b/a2/a1x)은 접을 게 없다
    expect(collapsedIds()).toEqual(['a', 'a1']);
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
