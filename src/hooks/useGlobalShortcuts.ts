import { useEffect } from 'react';
import { useMindMapStore, type NavDirection } from '../store/useMindMapStore';

// LR 배치 기준: 오른쪽=자식 방향, 왼쪽=부모 방향, 위아래=형제
const ARROW_TO_DIR: Record<string, NavDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * 키 이벤트 하나를 처리한다. 훅과 분리해 둔 이유는 테스트에서
 * 실제 DOM 이벤트를 만들지 않고도 분기를 직접 검증하기 위해서다.
 */
export function handleShortcut(
  e: KeyboardEvent,
  undo: () => void,
  redo: () => void
): void {
  const target = e.target as HTMLElement | null;
  // 입력 필드 / 노트 에디터(contentEditable) 안에서는 단축키를 가로채지 않는다
  const inField =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable === true;

  const store = useMindMapStore.getState();

  // ── Ctrl/Meta 조합: 검색 / 되돌리기·다시실행 ──
  if (e.ctrlKey || e.metaKey) {
    // 검색은 입력 필드 안에서도 열 수 있어야 한다 (노트 쓰다가 바로 검색)
    if (e.key === 'f') {
      e.preventDefault();
      store.setSearchOpen(true);
      return;
    }
    if (inField) return; // 입력 중에는 자체 undo에 맡긴다
    if (e.key === 'z') {
      e.preventDefault();
      undo();
    } else if (e.key === 'y') {
      e.preventDefault();
      redo();
    }
    return;
  }

  // Escape는 입력 중에도 처리해야 한다 (검색창 닫기)
  if (e.key === 'Escape' && store.isSearchOpen) {
    e.preventDefault();
    store.setSearchOpen(false);
    return;
  }

  if (inField) return; // 라벨/노트/검색 입력 중에는 노드 단축키 무시

  const sel = store.selectedNodeId;

  // Tab = 자식 추가, Enter = 형제 추가 (둘 다 만든 뒤 곧바로 편집 모드)
  if (e.key === 'Tab') {
    e.preventDefault(); // 기본 포커스 이동 방지
    if (!sel) return;
    const newId = store.addChildNode(sel);
    store.setEditingNodeId(newId);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (!sel) return;
    const newId = store.addSiblingNode(sel);
    if (newId) store.setEditingNodeId(newId);
  } else if (e.key === 'F2') {
    e.preventDefault();
    // 표 노드는 인라인 라벨 입력이 없으므로 텍스트 노드만 편집 모드로
    if (sel && store.mindMapData.nodes[sel]?.type === 'text') store.setEditingNodeId(sel);
  } else if (ARROW_TO_DIR[e.key]) {
    // 방향키 = 트리 탐색 (기본 스크롤 방지)
    e.preventDefault();
    store.selectRelative(ARROW_TO_DIR[e.key]);
  } else if (e.key === ' ') {
    // Space = 접기/펼치기
    e.preventDefault();
    if (sel) store.toggleCollapse(sel);
  } else if (e.key === 'Escape') {
    store.setSelectedNodeId(null);
  }
}

/** 전역 단축키를 window에 붙인다. */
export function useGlobalShortcuts(undo: () => void, redo: () => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleShortcut(e, undo, redo);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);
}
