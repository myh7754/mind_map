import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore, createEmptyMindMap } from './useMindMapStore';

/**
 * 과목별 여러 맵 지원 회귀 테스트.
 * 핵심: 맵을 갈아탈 때 undo가 이전 맵으로 새어나가면 안 된다.
 */
const store = () => useMindMapStore.getState();

describe('여러 맵 (과목별 분리)', () => {
  beforeEach(() => {
    useMindMapStore.temporal.getState().clear();
  });

  it('createEmptyMindMap은 매번 다른 id를 만든다', () => {
    const a = createEmptyMindMap('자바 공부');
    const b = createEmptyMindMap('영어 공부');
    expect(a.id).not.toBe(b.id);
    // 'default' 같은 슬롯 이름이면 여러 맵이 서로 덮어쓴다
    expect(a.id).not.toBe('default');
  });

  it('새 맵의 루트 라벨은 과목명이 된다', () => {
    const map = createEmptyMindMap('영어 공부');
    expect(map.title).toBe('영어 공부');
    expect(map.nodes[map.rootId].label).toBe('영어 공부');
    expect(map.children[map.rootId]).toEqual([]);
  });

  it('openMap은 맵을 갈아끼우고 배치까지 마친다', () => {
    const java = createEmptyMindMap('자바 공부');
    store().openMap(java, {});

    expect(store().mindMapData.id).toBe(java.id);
    expect(store().mindMapData.title).toBe('자바 공부');
    // 위치가 없던 맵이므로 배치가 돌아 positions가 채워져야 한다
    expect(Object.keys(store().positions)).toContain(java.rootId);
  });

  it('맵을 바꾸면 undo 히스토리가 비워진다 (이전 맵으로 되돌아가지 않는다)', () => {
    const java = createEmptyMindMap('자바 공부');
    store().openMap(java, {});
    store().addChildNode(java.rootId);
    expect(useMindMapStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    const english = createEmptyMindMap('영어 공부');
    store().openMap(english, {});

    expect(useMindMapStore.temporal.getState().pastStates.length).toBe(0);

    // undo를 눌러도 자바 맵으로 돌아가지 않는다
    useMindMapStore.temporal.getState().undo();
    expect(store().mindMapData.id).toBe(english.id);
  });

  it('맵을 바꾸면 선택/노트 드로어 상태가 초기화된다', () => {
    const java = createEmptyMindMap('자바 공부');
    store().openMap(java, {});
    const child = store().addChildNode(java.rootId);
    store().openNoteDrawer(child);
    expect(store().isNoteDrawerOpen).toBe(true);

    store().openMap(createEmptyMindMap('영어 공부'), {});

    expect(store().selectedNodeId).toBeNull();
    expect(store().isNoteDrawerOpen).toBe(false);
  });

  it('저장된 위치가 있으면 그대로 쓴다 (재배치하지 않음)', () => {
    const map = createEmptyMindMap('수학');
    const saved = { [map.rootId]: { x: 123, y: 456 } };
    store().openMap(map, saved);
    expect(store().positions[map.rootId]).toEqual({ x: 123, y: 456 });
  });

  it('setMapTitle은 제목만 바꾼다', () => {
    const map = createEmptyMindMap('임시');
    store().openMap(map, {});
    store().setMapTitle('영어 공부');

    expect(store().mindMapData.title).toBe('영어 공부');
    expect(store().mindMapData.id).toBe(map.id); // id는 그대로
  });
});
