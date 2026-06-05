# mind_map

XMind/EdrawMind 대체를 목표로 하는 오픈소스 마인드맵 + 노드별 위키 노트 하이브리드 웹앱.

## 주요 기능

- 마인드맵 노드 추가/편집/삭제, 표(Table) 노드
- 노드별 노션 스타일 WYSIWYG 마크다운 노트 (슬라이드 패널, 크기 조절 가능)
- S-curve Bezier 연결선, 브랜치 접기/펼치기
- Undo/Redo (Ctrl+Z / Ctrl+Y)
- IndexedDB 자동 저장
- JSON 저장/불러오기, 마크다운 내보내기

## 기술 스택

- Vite 5 + React + TypeScript
- @xyflow/react (캔버스), @dagrejs/dagre (자동 레이아웃)
- zustand + zundo (상태 관리 + undo/redo)
- BlockNote + @mantine/core (WYSIWYG 에디터)
- idb (IndexedDB), Tailwind CSS v4

## 개발

```bash
npm install
npm run dev      # http://localhost:5174
npm run build
npm test
```
