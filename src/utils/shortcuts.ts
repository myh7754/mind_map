/**
 * 단축키 목록 — 화면에 보여주기 위한 단일 출처.
 *
 * 실제 처리는 `hooks/useGlobalShortcuts.ts`가 한다. 이 파일은 그것을 사람이
 * 읽는 형태로 적어둔 것이고, 도움말 모달과 툴바 메뉴가 같이 쓴다.
 * 여기와 실제 동작이 어긋나면 "기능은 있는데 아무도 모르는" 상태가 된다 —
 * 실제로 그래서 사용자가 '모두 펼치기'의 존재를 모르고 있었다.
 */
export interface Shortcut {
  keys: string;
  desc: string;
}

export interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: '노드 만들기',
    items: [
      { keys: 'Tab', desc: '자식 노드 추가' },
      { keys: 'Enter', desc: '형제 노드 추가' },
      { keys: 'F2', desc: '이름 고치기' },
      { keys: 'Delete', desc: '노드 삭제' },
    ],
  },
  {
    title: '보기',
    items: [
      { keys: 'Space', desc: '가지 접기 / 펼치기' },
      // 이 두 문구는 ViewMenu가 keysFor()로 찾아 쓴다 — 바꾸면 메뉴의 단축키 표시가 사라진다
      { keys: 'Ctrl + E', desc: '모두 펼치기' },
      { keys: 'Ctrl + Shift + E', desc: '모두 접기' },
      { keys: 'Ctrl + 1 ~ 4', desc: '그 단계까지만' },
    ],
  },
  {
    title: '이동 · 찾기',
    items: [
      { keys: '← ↑ ↓ →', desc: '선택 옮기기' },
      { keys: 'Ctrl + F', desc: '노드 · 노트 검색' },
      { keys: '좌 + 우 드래그', desc: '화면 이동' },
    ],
  },
  {
    title: '되돌리기',
    items: [
      { keys: 'Ctrl + Z', desc: '실행 취소' },
      { keys: 'Ctrl + Y', desc: '다시 실행' },
    ],
  },
  {
    title: '기타',
    items: [
      { keys: '?', desc: '이 창 열기' },
      { keys: 'Esc', desc: '창 닫기 · 선택 해제' },
    ],
  },
];

/** 툴바 메뉴에서 항목 옆에 키를 표시할 때 쓴다 */
export function keysFor(desc: string): string | undefined {
  for (const group of SHORTCUT_GROUPS) {
    const hit = group.items.find((i) => i.desc === desc);
    if (hit) return hit.keys;
  }
  return undefined;
}
