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

  // 전역 단축키: Ctrl+Z/Y(되돌리기) + XMind식 노드 편집(Tab/Enter/F2/Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 입력 필드 / 노트 에디터(contentEditable) 안에서는 단축키를 가로채지 않는다
      const inField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      // ── Ctrl/Meta 조합: 되돌리기/다시실행 ──
      if (e.ctrlKey || e.metaKey) {
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

      if (inField) return; // 라벨/노트 편집 중에는 노드 단축키 무시

      const store = useMindMapStore.getState();
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
      } else if (e.key === 'Escape') {
        store.setSelectedNodeId(null);
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
