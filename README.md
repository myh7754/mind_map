# mind_map

XMind/EdrawMind 대체를 목표로 하는 오픈소스 마인드맵 + 노드별 위키 노트 하이브리드 웹앱.

## 주요 기능

- **과목별 마인드맵 분리** — 자바 공부 / 영어 공부처럼 여러 맵을 만들어 전환
- 마인드맵 노드 추가/편집/삭제, 표(Table) 노드
- 노드별 노션 스타일 WYSIWYG 마크다운 노트 (슬라이드 패널, 크기 조절 가능)
- **위키링크 `[[노드 이름]]`** — 노트에서 다른 노드를 참조하면 연결/역링크가 자동으로
  잡히고, 클릭해서 그 노드로 이동합니다 (트리 구조와 별개인 그래프 연결)
- S-curve Bezier 연결선, 브랜치 접기/펼치기
- 노드 실측 크기 기반 자동 배치 (표 노드처럼 큰 노드도 겹치지 않음)
- 드래그로 부모 변경 / 형제 순서 변경 (정렬된 슬롯 미리보기)
- 노드·노트 본문 통합 검색 (Ctrl+F) — 접힌 가지는 자동으로 펼쳐서 이동
- Undo/Redo (Ctrl+Z / Ctrl+Y)
- IndexedDB 자동 저장
- 노드 색상 지정 + 가지 전체 컬러테마 (간선 색도 따라감)
- JSON 저장/불러오기, 마크다운 내보내기/가져오기, PNG 이미지 내보내기

## 단축키

| 키 | 동작 |
|---|---|
| `Tab` | 선택 노드에 자식 추가 (곧바로 편집) |
| `Enter` | 형제 노드 추가 (곧바로 편집) |
| `F2` | 선택 노드 라벨 편집 |
| `←` `↑` `↓` `→` | 부모 / 이전 형제 / 다음 형제 / 첫 자식으로 이동 |
| `Space` | 선택 노드 접기·펼치기 |
| `Delete` | 선택 노드(들) 삭제 |
| `Ctrl+F` | 검색 |
| `Ctrl+Z` / `Ctrl+Y` | 실행 취소 / 다시 실행 |
| `Esc` | 검색 닫기 / 선택 해제 |

캔버스 조작: 빈 곳 좌클릭 드래그 = 박스 선택, 좌+우 버튼 동시 드래그 = 화면 이동.

## 기술 스택

- Vite 5 + React 19 + TypeScript
- @xyflow/react (캔버스) + 자체 tidy-tree 레이아웃 (`src/utils/layout.ts`)
- zustand + zundo (상태 관리 + undo/redo)
- BlockNote + @mantine/core (WYSIWYG 에디터, 지연 로딩)
- idb (IndexedDB), Tailwind CSS v4

## 개발

```bash
npm install
npm run dev        # http://localhost:5174
npm run lint       # ESLint
npm run typecheck  # tsc
npm test           # Vitest
npm run build
```

## 배포 (Vercel)

설정 파일이 필요 없습니다. Vercel이 Vite를 자동 감지해 `npm run build` → `dist`를 서빙합니다.

```
1. git push
2. vercel.com → Add New → Project → 저장소 Import → Deploy
```

라우터가 없어서 SPA rewrite(`vercel.json`)도 불필요합니다. react-router를 넣으면 그때 추가하세요.

## 데이터 저장

현재 데이터는 **브라우저 안에만** 있습니다 (IndexedDB). 서버가 없으므로:

- 기기·브라우저마다 데이터가 따로 놉니다
- 브라우저 데이터를 지우면 사라집니다
- 기기 간 이동은 JSON 내보내기/불러오기로 합니다

### 계정별 클라우드 동기화로 갈 때

지금 구조는 그 전환을 염두에 두고 있습니다:

- 맵 `id`는 `nanoid` 전역 고유값입니다 (`'default'` 같은 슬롯 이름이 아님) → 여러
  사용자의 맵이 한 저장소에 섞여도 그대로 씁니다
- 저장할 때마다 `updatedAt`을 남깁니다 → 동기화 충돌 판정에 필요합니다
- 저장 접근이 `src/db/mindmapDB.ts` 한 곳에 모여 있습니다
  (`saveMindMap` / `loadMindMap` / `listMaps` / `deleteMap`) → 이 모듈 내부만
  원격 API 호출로 바꾸면 나머지 코드는 그대로입니다

남은 일은 레코드에 `ownerId`를 추가하고, 인증과 Vercel 서버리스 함수(`api/`)를
붙이는 것입니다. 아직 구현하지 않았습니다.
