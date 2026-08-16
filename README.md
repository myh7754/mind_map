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

## 클라우드 동기화 (선택)

로그인하면 계정별로 맵이 클라우드에 저장되어 기기 간에 이어서 볼 수 있습니다.
**설정하지 않으면 앱은 로컬 전용으로 그대로 동작합니다** — 클라우드는 켜면 좋은
것이지 있어야 도는 게 아닙니다.

### 켜는 방법

1. [supabase.com](https://supabase.com) 에서 프로젝트를 만듭니다 (무료)
2. **SQL Editor** 에 `supabase/schema.sql` 내용을 붙여넣고 실행합니다
3. **Authentication → Providers** 에서 GitHub, Google 을 켜고 각 OAuth 앱을 등록합니다
   - Callback URL 은 Supabase 가 알려주는 값을 그대로 씁니다
4. **Project Settings → API** 에서 URL 과 `anon` 키를 복사해 `.env.local` 에 넣습니다
   (`.env.example` 참고)
5. Vercel 에 배포한다면 **Settings → Environment Variables** 에도 같은 두 값을 넣습니다

> `anon` 키는 클라이언트에 실려도 되는 공개 키입니다. 실제 접근 제어는 DB 의
> RLS 가 합니다. `service_role` 키는 RLS 를 우회하므로 절대 넣지 마세요.

### 동작 방식

- **로컬 우선**: 편집은 항상 IndexedDB 에 먼저 저장되고, 로그인해 있으면 클라우드로 올라갑니다.
  오프라인에서도 그대로 씁니다.
- **충돌 처리**: 맵 단위 last-write-wins (`updatedAt` 이 최신인 쪽이 이깁니다).
  노드 단위 병합은 하지 않습니다 — 같은 노드를 양쪽에서 다르게 고쳤을 때 무엇이
  옳은지 추측해야 하고, 틀리면 조용히 작업을 뭉갭니다.
- **삭제**: 소프트 삭제로 기록됩니다. 그냥 지우면 다른 기기가 "여긴 없네" 하고
  되살려 올립니다.
- **격리**: "각자 자기 맵만" 은 앱이 아니라 DB 의 RLS 가 강제합니다. 앱 쿼리에
  실수가 있어도 남의 행이 새지 않습니다.

동기화 판단 로직은 `src/utils/syncMerge.ts` 의 순수 함수(`planSync`)로 분리되어
있어 서버 없이 전부 테스트됩니다.
