import { describe, it, expect, beforeEach } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

/**
 * undo/redo 회귀 테스트.
 * 핵심: 노드를 추가한 뒤 undo하면 노드가 사라지고, redo하면 다시 생겨야 한다.
 * 또한 노드 "선택"(onRfNodesChange) 같은 데이터 무관 변경은 히스토리에 쌓이면 안 된다.
 */
describe('undo/redo', () => {
  beforeEach(() => {
    // 각 테스트 전에 히스토리 초기화
    useMindMapStore.temporal.getState().clear();
  });

  it('노드 추가 → undo 하면 노드가 사라진다', () => {
    const rootId = useMindMapStore.getState().mindMapData.rootId;
    const before = Object.keys(useMindMapStore.getState().mindMapData.nodes).length;

    useMindMapStore.getState().addChildNode(rootId, 'text');
    const afterAdd = Object.keys(useMindMapStore.getState().mindMapData.nodes).length;
    expect(afterAdd).toBe(before + 1);

    // undo
    useMindMapStore.temporal.getState().undo();
    const afterUndo = Object.keys(useMindMapStore.getState().mindMapData.nodes).length;
    expect(afterUndo).toBe(before);
  });

  it('undo 후 redo 하면 노드가 다시 생긴다', () => {
    const rootId = useMindMapStore.getState().mindMapData.rootId;
    const before = Object.keys(useMindMapStore.getState().mindMapData.nodes).length;

    useMindMapStore.getState().addChildNode(rootId, 'text');
    useMindMapStore.temporal.getState().undo();
    useMindMapStore.temporal.getState().redo();

    const afterRedo = Object.keys(useMindMapStore.getState().mindMapData.nodes).length;
    expect(afterRedo).toBe(before + 1);
  });

  it('노드 선택(onRfNodesChange)은 히스토리에 기록되지 않는다', () => {
    const rootId = useMindMapStore.getState().mindMapData.rootId;
    useMindMapStore.getState().addChildNode(rootId, 'text');

    const pastLenAfterAdd = useMindMapStore.temporal.getState().pastStates.length;

    // 노드 선택 시뮬레이션 (선택 변경 change)
    useMindMapStore.getState().onRfNodesChange([
      { id: rootId, type: 'select', selected: true },
    ]);
    useMindMapStore.getState().onRfNodesChange([
      { id: rootId, type: 'select', selected: false },
    ]);

    const pastLenAfterSelect = useMindMapStore.temporal.getState().pastStates.length;
    // 선택만으로는 히스토리가 늘어나면 안 된다
    expect(pastLenAfterSelect).toBe(pastLenAfterAdd);
  });

  it('선택 후 undo는 여전히 노드 추가를 되돌린다 (선택 노이즈에 막히지 않음)', () => {
    const rootId = useMindMapStore.getState().mindMapData.rootId;
    const before = Object.keys(useMindMapStore.getState().mindMapData.nodes).length;

    useMindMapStore.getState().addChildNode(rootId, 'text');
    // 추가 후 이런저런 선택을 했다고 가정
    useMindMapStore.getState().onRfNodesChange([
      { id: rootId, type: 'select', selected: true },
    ]);

    useMindMapStore.temporal.getState().undo();
    const afterUndo = Object.keys(useMindMapStore.getState().mindMapData.nodes).length;
    expect(afterUndo).toBe(before);
  });
});
