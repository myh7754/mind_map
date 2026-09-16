import { Suspense, lazy, useState } from 'react';
import { useMindMapStore } from '../../store/useMindMapStore';
import { ErrorBoundary } from '../ErrorBoundary';
import { ResizeHandle } from './ResizeHandle';
import { LinkPanel } from './LinkPanel';

// BlockNote + Mantine은 1MB가 넘는데 노트 드로어는 기본으로 닫혀 있다.
// 지연 로딩해서 초기 번들에서 떼어낸다 (드로어를 처음 열 때 받아온다).
const BlockNoteEditor = lazy(() =>
  import('./BlockNoteEditor').then((m) => ({ default: m.BlockNoteEditor }))
);

const SIDE_KEY = 'note-panel-side';

export function NoteDrawer() {
  // 화면 배치 취향이라 맵 데이터·스토어가 아니라 이 기기의 localStorage에만 둔다
  const [side, setSide] = useState<'left' | 'right'>(() =>
    localStorage.getItem(SIDE_KEY) === 'left' ? 'left' : 'right'
  );
  const toggleSide = () => {
    const next = side === 'right' ? 'left' : 'right';
    localStorage.setItem(SIDE_KEY, next);
    setSide(next);
  };

  const {
    isNoteDrawerOpen,
    closeNoteDrawer,
    selectedNodeId,
    noteDrawerWidth,
    setNoteDrawerWidth,
    mindMapData,
    updateNodeNote,
    readOnly,
  } = useMindMapStore();

  const selectedNode = selectedNodeId ? mindMapData.nodes[selectedNodeId] : null;

  const note = selectedNode?.note ?? '';

  return (
    <div
      // order-first: 부모 flex 행에서 캔버스보다 앞(왼쪽)으로 보낸다
      className={`relative flex-shrink-0 flex flex-col bg-slate-900 border-slate-700 transition-all duration-200 overflow-hidden ${
        side === 'left' ? 'order-first border-r' : 'border-l'
      }`}
      style={{ width: isNoteDrawerOpen ? noteDrawerWidth : 0 }}
    >
      {isNoteDrawerOpen && (
        <>
          <ResizeHandle onResize={setNoteDrawerWidth} side={side} />

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
            <span className="text-sm font-semibold text-slate-200 truncate max-w-[80%]">
              {selectedNode ? `📝 ${selectedNode.label}` : '노트'}
            </span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                className="text-slate-400 hover:text-slate-200 text-sm leading-none"
                onClick={toggleSide}
                title={side === 'right' ? '왼쪽으로 옮기기' : '오른쪽으로 옮기기'}
              >
                {side === 'right' ? '⇤' : '⇥'}
              </button>
              <button
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
                onClick={closeNoteDrawer}
                title="닫기"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 에디터 영역 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {selectedNodeId ? (
              // key에 nodeId를 주면 노드를 바꿀 때 경계 상태(에러)도 같이 초기화된다
              <ErrorBoundary
                key={selectedNodeId}
                label="노트 에디터를 불러오지 못했습니다. 연결을 확인해 주세요."
              >
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                      에디터 불러오는 중…
                    </div>
                  }
                >
                  <BlockNoteEditor
                    nodeId={selectedNodeId}
                    note={note}
                    editable={!readOnly}
                    onSave={(content) => updateNodeNote(selectedNodeId, content)}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                노드를 선택하세요
              </div>
            )}
          </div>

          {selectedNodeId && <LinkPanel nodeId={selectedNodeId} />}
        </>
      )}
    </div>
  );
}
