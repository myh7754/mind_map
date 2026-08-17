import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleShortcut } from './useGlobalShortcuts';
import { useMindMapStore } from '../store/useMindMapStore';

/**
 * 전역 단축키 분기 테스트.
 * 지금까지 이 로직은 수동 확인이 전부였다 — 특히 inField 가드와
 * Escape의 이중 역할(검색 닫기 vs 선택 해제)이 조용히 깨지기 쉬운 지점이다.
 */
function keyEvent(
  key: string,
  opts: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; target?: EventTarget } = {}
): KeyboardEvent {
  const e = new KeyboardEvent('keydown', {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    cancelable: true,
  });
  if (opts.target) {
    Object.defineProperty(e, 'target', { value: opts.target, configurable: true });
  }
  return e;
}

const store = () => useMindMapStore.getState();

describe('handleShortcut', () => {
  let undo: ReturnType<typeof vi.fn>;
  let redo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    undo = vi.fn();
    redo = vi.fn();
    useMindMapStore.temporal.getState().clear();
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
    store().setSelectedNodeId(null);
    store().setEditingNodeId(null);
    store().setSearchOpen(false);
    store().setShortcutsOpen(false);
    store().applyLayout();
    useMindMapStore.temporal.getState().clear();
  });

  it('Tab은 선택 노드에 자식을 추가하고 편집 모드로 넣는다', () => {
    store().setSelectedNodeId('a');
    handleShortcut(keyEvent('Tab'), undo, redo);

    const kids = store().mindMapData.children.a;
    expect(kids).toHaveLength(2);
    expect(store().editingNodeId).toBe(kids[1]);
  });

  it('선택이 없으면 Tab은 노드를 만들지 않는다', () => {
    const before = Object.keys(store().mindMapData.nodes).length;
    handleShortcut(keyEvent('Tab'), undo, redo);
    expect(Object.keys(store().mindMapData.nodes).length).toBe(before);
  });

  it('Enter는 형제를 추가한다', () => {
    store().setSelectedNodeId('a');
    handleShortcut(keyEvent('Enter'), undo, redo);
    expect(store().mindMapData.children.root).toHaveLength(3);
  });

  it('루트에서 Enter는 형제를 만들지 않는다', () => {
    store().setSelectedNodeId('root');
    const before = Object.keys(store().mindMapData.nodes).length;
    handleShortcut(keyEvent('Enter'), undo, redo);
    expect(Object.keys(store().mindMapData.nodes).length).toBe(before);
  });

  it('F2는 텍스트 노드를 편집 모드로 만든다', () => {
    store().setSelectedNodeId('a');
    handleShortcut(keyEvent('F2'), undo, redo);
    expect(store().editingNodeId).toBe('a');
  });

  it('방향키는 선택을 옮긴다', () => {
    store().setSelectedNodeId('root');
    handleShortcut(keyEvent('ArrowRight'), undo, redo);
    expect(store().selectedNodeId).toBe('a');
    handleShortcut(keyEvent('ArrowDown'), undo, redo);
    expect(store().selectedNodeId).toBe('b');
    handleShortcut(keyEvent('ArrowLeft'), undo, redo);
    expect(store().selectedNodeId).toBe('root');
  });

  it('Space는 접기/펼치기를 토글한다', () => {
    store().setSelectedNodeId('a');
    handleShortcut(keyEvent(' '), undo, redo);
    expect(store().mindMapData.nodes.a.collapsed).toBe(true);
    handleShortcut(keyEvent(' '), undo, redo);
    expect(store().mindMapData.nodes.a.collapsed).toBe(false);
  });

  it('Escape는 선택을 해제한다', () => {
    store().setSelectedNodeId('a');
    handleShortcut(keyEvent('Escape'), undo, redo);
    expect(store().selectedNodeId).toBeNull();
  });

  it('검색이 열려 있으면 Escape는 검색을 닫고 선택은 유지한다', () => {
    store().setSelectedNodeId('a');
    store().setSearchOpen(true);

    handleShortcut(keyEvent('Escape'), undo, redo);

    expect(store().isSearchOpen).toBe(false);
    expect(store().selectedNodeId).toBe('a'); // 선택까지 날아가면 안 된다
  });

  it('Ctrl+Z / Ctrl+Y는 undo/redo를 호출한다', () => {
    handleShortcut(keyEvent('z', { ctrlKey: true }), undo, redo);
    expect(undo).toHaveBeenCalledTimes(1);
    handleShortcut(keyEvent('y', { ctrlKey: true }), undo, redo);
    expect(redo).toHaveBeenCalledTimes(1);
  });

  describe('단축키 도움말', () => {
    it('?는 도움말을 연다', () => {
      handleShortcut(keyEvent('?', { shiftKey: true }), undo, redo);
      expect(store().isShortcutsOpen).toBe(true);
    });

    it('Escape는 도움말을 닫는다', () => {
      store().setShortcutsOpen(true);
      handleShortcut(keyEvent('Escape'), undo, redo);
      expect(store().isShortcutsOpen).toBe(false);
    });

    it('도움말이 열려 있으면 Escape가 검색보다 도움말을 먼저 닫는다', () => {
      store().setSearchOpen(true);
      store().setShortcutsOpen(true);

      handleShortcut(keyEvent('Escape'), undo, redo);

      expect(store().isShortcutsOpen).toBe(false);
      expect(store().isSearchOpen).toBe(true); // 검색은 아직 열려 있어야 한다
    });

    it('입력 중에는 ?가 도움말을 열지 않는다 (물음표를 타이핑한 것)', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      handleShortcut(keyEvent('?', { shiftKey: true, target: input }), undo, redo);
      expect(store().isShortcutsOpen).toBe(false);
    });
  });

  // 트리: root → a, b ; a → a1  (자식이 있는 건 root 와 a)
  describe('펼치기 / 접기 단축키', () => {
    const collapsedIds = () =>
      Object.values(store().mindMapData.nodes)
        .filter((n) => n.collapsed)
        .map((n) => n.id)
        .sort();

    it('Ctrl+Shift+E는 모두 접는다', () => {
      handleShortcut(keyEvent('E', { ctrlKey: true, shiftKey: true }), undo, redo);
      expect(collapsedIds()).toEqual(['a']);
    });

    it('Ctrl+E는 모두 펼친다', () => {
      store().setAllCollapsed(true);
      handleShortcut(keyEvent('e', { ctrlKey: true }), undo, redo);
      expect(collapsedIds()).toEqual([]);
    });

    it('Ctrl+1은 1단계까지만 펼친다', () => {
      handleShortcut(keyEvent('1', { ctrlKey: true }), undo, redo);
      expect(store().mindMapData.nodes.a.collapsed).toBe(true);
    });

    it('Ctrl+2는 2단계까지 펼친다', () => {
      store().setAllCollapsed(true);
      handleShortcut(keyEvent('2', { ctrlKey: true }), undo, redo);
      expect(store().mindMapData.nodes.a.collapsed).toBe(false);
    });

    it('Ctrl+5 이상은 무시한다 (단계 단축키는 1~4)', () => {
      store().setAllCollapsed(true);
      handleShortcut(keyEvent('5', { ctrlKey: true }), undo, redo);
      expect(store().mindMapData.nodes.a.collapsed).toBe(true); // 그대로
    });

    it('입력 중에는 Ctrl+E가 동작하지 않는다 (노트 쓰다가 맵이 접히면 안 된다)', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      store().setAllCollapsed(true);

      handleShortcut(keyEvent('e', { ctrlKey: true, target: input }), undo, redo);

      expect(collapsedIds()).toEqual(['a']); // 펼쳐지지 않았다
    });
  });

  describe('입력 필드 안에서', () => {
    let input: HTMLInputElement;

    beforeEach(() => {
      input = document.createElement('input');
      document.body.appendChild(input);
      store().setSelectedNodeId('a');
    });

    it('Tab은 노드를 만들지 않는다 (라벨 편집 중)', () => {
      const before = Object.keys(store().mindMapData.nodes).length;
      handleShortcut(keyEvent('Tab', { target: input }), undo, redo);
      expect(Object.keys(store().mindMapData.nodes).length).toBe(before);
    });

    it('Ctrl+Z는 캔버스 undo를 부르지 않는다 (에디터 자체 undo에 맡김)', () => {
      handleShortcut(keyEvent('z', { ctrlKey: true, target: input }), undo, redo);
      expect(undo).not.toHaveBeenCalled();
    });

    it('Ctrl+F는 예외적으로 동작한다 (노트 쓰다가 바로 검색)', () => {
      handleShortcut(keyEvent('f', { ctrlKey: true, target: input }), undo, redo);
      expect(store().isSearchOpen).toBe(true);
    });

    it('방향키는 가로채지 않는다 (커서 이동이어야 함)', () => {
      const e = keyEvent('ArrowDown', { target: input });
      handleShortcut(e, undo, redo);
      expect(store().selectedNodeId).toBe('a'); // 선택이 움직이면 안 된다
      expect(e.defaultPrevented).toBe(false);
    });

    it('contentEditable(노트 에디터)도 동일하게 보호된다', () => {
      const div = document.createElement('div');
      div.contentEditable = 'true';
      // jsdom은 contentEditable로 isContentEditable을 채우지 않으므로 직접 지정
      Object.defineProperty(div, 'isContentEditable', { value: true });
      document.body.appendChild(div);

      const before = Object.keys(store().mindMapData.nodes).length;
      handleShortcut(keyEvent('Enter', { target: div }), undo, redo);
      expect(Object.keys(store().mindMapData.nodes).length).toBe(before);
    });
  });
});
