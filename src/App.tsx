import { useEffect, useState } from 'react';
import { MindMapCanvas } from './components/MindMapCanvas/MindMapCanvas';
import { Toolbar } from './components/Toolbar/Toolbar';
import { NoteDrawer } from './components/NoteDrawer/NoteDrawer';
import { SearchPanel } from './components/SearchPanel/SearchPanel';
import { SyncBanner } from './components/SyncBanner/SyncBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useMindMapStore, useUndoRedo } from './store/useMindMapStore';
import { useAutosave } from './hooks/useAutosave';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useAuth } from './hooks/useAuth';
import { syncNow } from './db/cloudSync';
import { listMaps, loadMindMap } from './db/mindmapDB';

// 마지막으로 열어둔 맵. 새로고침해도 보던 과목으로 돌아온다.
const LAST_MAP_KEY = 'last-map-id';

export default function App() {
  // 선택자로 구독한다. 스토어 전체를 구독하면 저장 상태가 바뀔 때마다
  // App까지 다시 렌더된다.
  const mindMapData = useMindMapStore((s) => s.mindMapData);
  const positions = useMindMapStore((s) => s.positions);
  const setNoteDrawerWidth = useMindMapStore((s) => s.setNoteDrawerWidth);
  const loadFromPersisted = useMindMapStore((s) => s.loadFromPersisted);
  const applyLayout = useMindMapStore((s) => s.applyLayout);
  const { undo, redo } = useUndoRedo();

  // 초기 로드가 끝나기 전에는 자동 저장을 켜지 않는다 (빈 초기값이 덮어쓰는 것 방지)
  const [ready, setReady] = useState(false);

  // 마운트 시: localStorage에서 noteDrawerWidth 복원 + IndexedDB에서 마인드맵 로드
  useEffect(() => {
    const savedWidth = localStorage.getItem('note-panel-width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed)) setNoteDrawerWidth(parsed);
    }

    // 마지막에 보던 맵 → 없으면 가장 최근 수정한 맵 → 그것도 없으면 초기 데이터
    listMaps()
      .then(async (maps) => {
        const lastId = localStorage.getItem(LAST_MAP_KEY);
        const target = maps.find((m) => m.id === lastId) ?? maps[0];
        const persisted = target ? await loadMindMap(target.id) : undefined;
        if (persisted) {
          loadFromPersisted(persisted.mindMapData, persisted.positions);
        } else {
          applyLayout();
        }
      })
      .catch((err: unknown) => {
        // 불러오기 실패는 초기 데이터로 계속 진행하되, 조용히 넘기지는 않는다
        const message = err instanceof Error ? err.message : String(err);
        useMindMapStore.getState().setSaveStatus('error', `불러오기 실패: ${message}`);
        applyLayout();
      })
      .finally(() => setReady(true));
    // 마운트 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 보고 있는 맵을 기억해 둔다
  useEffect(() => {
    if (ready) localStorage.setItem(LAST_MAP_KEY, mindMapData.id);
  }, [mindMapData.id, ready]);

  // 로그인하면 한 번 맞춘다. 로컬에만 있던 맵이 올라가고, 다른 기기 것이 내려온다.
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!ready || !userId) return;
    let cancelled = false;
    syncNow()
      .then(async (result) => {
        if (cancelled || !result || (result.pulled === 0 && result.deletedLocal === 0)) return;
        // 내려받은 게 있으면 지금 보고 있는 맵을 새로 읽어 화면에 반영한다
        const store = useMindMapStore.getState();
        const maps = await listMaps();
        const current = maps.find((m) => m.id === store.mindMapData.id) ?? maps[0];
        if (!current) return;
        const persisted = await loadMindMap(current.id);
        if (persisted && !cancelled) store.openMap(persisted.mindMapData, persisted.positions);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        useMindMapStore.getState().setSaveStatus('error', `동기화 실패: ${message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, ready]);

  useAutosave(mindMapData, positions, ready);
  useGlobalShortcuts(undo, redo);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <Toolbar />
      <div className="flex flex-1 min-h-0 relative">
        <ErrorBoundary label="캔버스를 표시하지 못했습니다.">
          <MindMapCanvas />
        </ErrorBoundary>
        <SyncBanner />
        <SearchPanel />
        <NoteDrawer />
      </div>
    </div>
  );
}
