# Mind Map Application — Design Spec

**Date:** 2026-06-01  
**Status:** Approved

---

## 1. 배경 및 목표

XMind, EdrawMind 같은 유료 마인드맵 도구의 핵심 기능을 제한 없이 사용할 수 있는 오픈소스 웹 애플리케이션을 만든다.
단순한 노드 그래프를 넘어 **마인드맵 + 노드별 위키 노트** 하이브리드 형태로, 키워드 탐색과 문서 작성을 같은 화면에서 처리한다.

---

## 2. 핵심 기능 (MVP)

| 기능 | 설명 |
|------|------|
| 마인드맵 에디터 | 노드 생성·편집·삭제, 드래그 이동, 줌·팬 |
| 자동 트리 레이아웃 | 노드 추가 시 자동 배치 (Dagre 기반) |
| 노드 타입: 텍스트 | 기본 키워드 노드 |
| 노드 타입: 테이블 | 줄기 안에서 표 형태의 데이터 노드 |
| 베지어 연결선 | XMind/EdrawMind 스타일 S-곡선 |
| 노트 패널 | 노드별 Notion 스타일 WYSIWYG 마크다운 편집기 |
| 리사이즈 드로어 | 패널 경계 드래그로 너비 자유 조절, localStorage 저장 |
| 마크다운 내보내기 | 전체 트리 + 노트를 .md 파일로 출력 |
| 로컬 자동 저장 | IndexedDB 기반 자동 저장 (편집 시마다) |
| 파일 저장/불러오기 | JSON 파일로 내보내기·가져오기 (브라우저 무관 이식성) |
| Undo/Redo | Ctrl+Z / Ctrl+Y로 모든 편집 작업 되돌리기·다시하기 |
| 브랜치 접기/펼치기 | 노드 클릭으로 자식 브랜치 collapse/expand 토글 |

### 나중에 구현 (post-MVP)

- 클라우드 동기화 (Supabase 등 백엔드 연동 — IndexedDB가 오프라인 캐시 역할 유지)
- 키보드 단축키 (Tab: 자식 노드, Enter: 형제 노드, Delete: 노드 삭제, Ctrl+S: 저장 등 — XMind 기준)
- 파일 열기·저장 (.json)
- 테마 변경 (라이트/다크)
- 다중 마인드맵 탭

---

## 3. 기술 스택

| 역할 | 라이브러리 |
|------|-----------|
| 빌드 | Vite + TypeScript |
| UI 프레임워크 | React 18 |
| 마인드맵 캔버스 | `@xyflow/react` (react-flow v12) |
| 트리 레이아웃 엔진 | `dagre` |
| 상태 관리 + Undo/Redo | `zustand` + history middleware |
| 마크다운 에디터 | `BlockNote` (Notion 스타일 블록 에디터) |
| 스타일 | Tailwind CSS |
| 로컬 DB | `idb` (IndexedDB 래퍼) |
| 내보내기 | `file-saver` |

---

## 4. 데이터 모델

```typescript
interface MindNode {
  id: string;
  type: 'text' | 'table';
  label: string;
  note: string;            // BlockNote 내부 JSON 문자열 (내보내기 시 markdown으로 변환)
  tableData?: {
    headers: string[];
    rows: string[][];
  };
  style?: {
    color?: string;
  };
}

interface MindMapData {
  id: string;
  title: string;
  rootId: string;
  nodes: Record<string, MindNode>;   // id → node metadata
  // react-flow 의 Node[] / Edge[] 는 별도로 관리
}
```

react-flow의 `Node<MindNode>[]`와 `Edge[]`가 캔버스 렌더링 상태를 담당하고, `MindMapData`가 실제 콘텐츠 데이터를 담는다. 두 상태는 항상 동기화된다.

---

## 5. 컴포넌트 구조

```
App
├── Toolbar              — 노드 추가, 내보내기, Undo/Redo 버튼
├── MindMapCanvas        — @xyflow/react 래퍼
│   ├── TextNode         — 기본 텍스트 노드 (노트 버튼 + 접기 버튼 포함)
│   ├── TableNode        — 테이블 데이터 노드
│   └── BezierEdge       — S-곡선 커스텀 엣지
├── NoteDrawer           — 오른쪽 슬라이드 패널
│   ├── ResizeHandle     — 드래그 너비 조절 핸들
│   └── BlockNoteEditor  — WYSIWYG 마크다운 편집기
└── store/
    └── useMindMapStore  — zustand 상태 + undo/redo history stack
```

각 컴포넌트는 단일 책임을 가지며 props 인터페이스로 통신한다.

---

## 6. UI 레이아웃

```
┌─────────────────────────────────────────────────┐
│  Toolbar (상단 고정)                              │
├───────────────────────────┬─────────────────────┤
│                           ║                     │
│   MindMapCanvas           ║   NoteDrawer        │
│   (react-flow)            ║   (리사이즈 가능)    │
│                           ║   BlockNote 에디터   │
│                           ║                     │
└───────────────────────────┴─────────────────────┘
```

- NoteDrawer는 노드의 📝 버튼 클릭 시 오른쪽에서 슬라이드 인
- 드로어 왼쪽 경계선(ResizeHandle)을 드래그해 너비 조절
- 최소 너비 280px, 최대 너비 viewport의 75%
- 너비는 `localStorage['note-panel-width']`에 저장

---

## 7. 노드 연결선

`@xyflow/react`의 커스텀 엣지로 구현. 부모 노드 오른쪽 중앙 → 자식 노드 왼쪽 중앙을 잇는 cubic bezier:

```
d="M {px} {py} C {px+60} {py}, {cx-60} {cy}, {cx} {cy}"
```

- 브랜치 깊이별 색상 변경 (level 0: #6366f1, level 1: #8b5cf6, …)
- 선 두께: 루트에서 멀어질수록 얇아짐 (2px → 1.5px → 1px)

---

## 8. 마크다운 내보내기 규칙

트리를 깊이 우선 탐색하여 노드 깊이 → 제목 레벨로 변환:

```markdown
# 루트 토픽

루트 노드 노트 내용...

## 키워드 A

키워드 A 노트 내용...

### 세부 항목 1

| 컬럼1 | 컬럼2 |
|-------|-------|
| 값1   | 값2   |

## 키워드 B

...
```

테이블 노드는 마크다운 테이블 문법으로 인라인 변환된다.
노드 깊이가 6을 초과하면 `######` 이후 단계는 들여쓰기 목록(`-`)으로 처리한다.

---

## 9. 검증 방법

1. `npm run dev` 로 개발 서버 실행 후 브라우저에서 확인
2. 노드 추가/삭제/편집이 정상 동작하는지 확인
3. 📝 버튼 클릭 → NoteDrawer 슬라이드 인 확인
4. ResizeHandle 드래그 → 너비 변경 확인, 새로고침 후 너비 유지 확인
5. 테이블 노드 추가 후 마크다운 내보내기 결과물 확인
6. localStorage에서 데이터 복원 확인 (새로고침 후 상태 유지)
