import { useEffect, useState } from 'react';
import type { MindMapData } from './types';
import { MindMapCanvas } from './components/MindMapCanvas/MindMapCanvas';
import { NoteDrawer } from './components/NoteDrawer/NoteDrawer';
import { SearchPanel } from './components/SearchPanel/SearchPanel';
import { ShortcutsHelp } from './components/ShortcutsHelp/ShortcutsHelp';
import { AccountMenu } from './components/Toolbar/AccountMenu';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useMindMapStore } from './store/useMindMapStore';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { loadShowcaseMaps } from './db/showcase';

const noop = () => {};

/**
 * 비로그인 방문자 화면 — 공개 계정의 공부 기록을 읽기전용으로 보여준다.
 *
 * 안전은 readOnly 플래그가 아니라 "저장 경로가 없다"에 기댄다: 여기엔 useAutosave도
 * syncNow도 없다. 플래그를 빠뜨려 뭔가 바뀌어도 IndexedDB·DB 어디에도 쓰이지 않는다.
 */
export function ShowcaseViewer() {
  const mindMapData = useMindMapStore((s) => s.mindMapData);
  const openMap = useMindMapStore((s) => s.openMap);
  const setSearchOpen = useMindMapStore((s) => s.setSearchOpen);
  const setShortcutsOpen = useMindMapStore((s) => s.setShortcutsOpen);

  const [maps, setMaps] = useState<MindMapData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useMindMapStore.setState({ readOnly: true });
    loadShowcaseMaps()
      .then((list) => {
        // 저장된 좌표는 쓰지 않는다 — 방문자는 항상 정돈된 배치를 본다
        if (list[0]) openMap(list[0], {});
        setMaps(list);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => useMindMapStore.setState({ readOnly: false });
  }, [openMap]);

  useGlobalShortcuts(noop, noop);

  const btn = 'px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600';

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0 whitespace-nowrap [&>*]:shrink-0">
        <span className="text-indigo-400 font-semibold text-sm">🗺</span>
        {maps && maps.length > 1 ? (
          <select
            className="bg-slate-800 text-sm font-semibold text-slate-200 rounded px-1.5 py-0.5 outline-none"
            value={mindMapData.id}
            onChange={(e) => {
              const next = maps.find((m) => m.id === e.target.value);
              if (next) openMap(next, {});
            }}
            aria-label="맵 선택"
          >
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        ) : (
          maps?.[0] && <span className="text-sm font-semibold text-slate-200">{mindMapData.title}</span>
        )}
        {/* 편집이 안 되는 게 고장이 아니라 의도임을 알린다 */}
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
          읽기전용
        </span>
        <button className={btn} onClick={() => setSearchOpen(true)} title="노드·노트 검색 (Ctrl+F)">
          🔍 검색
        </button>

        <div className="flex-1" />

        <AccountMenu />
        <button className={btn} onClick={() => setShortcutsOpen(true)} title="단축키 (?)" aria-label="단축키">
          ⌨
        </button>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {error ? (
          <Message>맵을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Message>
        ) : maps === null ? (
          <Message>불러오는 중…</Message>
        ) : maps.length === 0 ? (
          <Message>아직 공개된 맵이 없습니다.</Message>
        ) : (
          <>
            <ErrorBoundary label="캔버스를 표시하지 못했습니다.">
              <MindMapCanvas />
            </ErrorBoundary>
            <SearchPanel />
            <NoteDrawer />
          </>
        )}
      </div>
      <ShortcutsHelp />
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">{children}</div>;
}
