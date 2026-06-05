import { useMindMapStore } from '../../store/useMindMapStore';
import { ResizeHandle } from './ResizeHandle';
import { BlockNoteEditor } from './BlockNoteEditor';

export function NoteDrawer() {
  const {
    isNoteDrawerOpen,
    closeNoteDrawer,
    selectedNodeId,
    noteDrawerWidth,
    setNoteDrawerWidth,
    mindMapData,
    updateNodeNote,
  } = useMindMapStore();

  const selectedNode = selectedNodeId ? mindMapData.nodes[selectedNodeId] : null;

  const note = selectedNode?.note ?? '';

  return (
    <div
      className="relative flex-shrink-0 flex flex-col bg-slate-900 border-l border-slate-700 transition-all duration-200 overflow-hidden"
      style={{ width: isNoteDrawerOpen ? noteDrawerWidth : 0 }}
    >
      {isNoteDrawerOpen && (
        <>
          <ResizeHandle onResize={setNoteDrawerWidth} />

          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
            <span className="text-sm font-semibold text-slate-200 truncate max-w-[80%]">
              {selectedNode ? `📝 ${selectedNode.label}` : '노트'}
            </span>
            <button
              className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              onClick={closeNoteDrawer}
              title="닫기"
            >
              ✕
            </button>
          </div>

          {/* 에디터 영역 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {selectedNodeId ? (
              <BlockNoteEditor
                key={selectedNodeId}
                nodeId={selectedNodeId}
                note={note}
                onSave={(content) => updateNodeNote(selectedNodeId, content)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                노드를 선택하세요
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
