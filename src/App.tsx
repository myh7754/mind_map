import { useEffect, useRef } from 'react';
import { MindMapCanvas } from './components/MindMapCanvas/MindMapCanvas';
import { Toolbar } from './components/Toolbar/Toolbar';
import { NoteDrawer } from './components/NoteDrawer/NoteDrawer';
import { useMindMapStore, useUndoRedo } from './store/useMindMapStore';
import { saveMindMap, loadMindMap } from './db/mindmapDB';

const AUTOSAVE_DELAY = 500;
const DEFAULT_MAP_ID = 'default';

export default function App() {
  const { mindMapData, positions, setNoteDrawerWidth, loadFromPersisted, applyLayout } =
    useMindMapStore();
  const { undo, redo } = useUndoRedo();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialized = useRef(false);

  // 마운트 시: localStorage에서 noteDrawerWidth 복원 + IndexedDB에서 마인드맵 로드
  useEffect(() => {
    const savedWidth = localStorage.getItem('note-panel-width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed)) setNoteDrawerWidth(parsed);
    }

    loadMindMap(DEFAULT_MAP_ID).then((persisted) => {
      if (persisted) {
        loadFromPersisted(persisted.mindMapData, persisted.positions);
      } else {
        // 초기 데이터도 IndexedDB에 저장
        applyLayout();
      }
      isInitialized.current = true;
    });
  // 마운트 한 번만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mindMapData/positions 변경 시 debounced 자동 저장
  useEffect(() => {
    if (!isInitialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMindMap(mindMapData, positions);
    }, AUTOSAVE_DELAY);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [mindMapData, positions]);

  // Ctrl+Z / Ctrl+Y 전역 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const target = e.target as HTMLElement;
      // 입력 필드 / 노트 에디터(contentEditable) 안에서는 자체 undo에 맡긴다
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <Toolbar />
      <div className="flex flex-1 min-h-0">
        <MindMapCanvas />
        <NoteDrawer />
      </div>
    </div>
  );
}
