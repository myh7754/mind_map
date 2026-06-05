import { useMindMapStore, useUndoRedo } from '../../store/useMindMapStore';
import { exportToMarkdown } from '../../utils/exportMarkdown';
import { downloadJson, loadJsonFile } from '../../utils/exportJson';
import { saveAs } from 'file-saver';

export function Toolbar() {
  const { mindMapData, selectedNodeId, addChildNode, applyLayout, loadFromPersisted } =
    useMindMapStore();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  const handleExportMarkdown = () => {
    const md = exportToMarkdown(mindMapData);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${mindMapData.title}.md`);
  };

  const handleSaveJson = () => downloadJson(mindMapData);

  const handleLoadJson = async () => {
    try {
      const data = await loadJsonFile();
      loadFromPersisted(data, {});
      setTimeout(applyLayout, 50);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0">
      <span className="text-indigo-400 font-semibold text-sm mr-2">🗺 MindMap</span>

      <button
        className="px-3 py-1.5 rounded text-xs bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!selectedNodeId}
        onClick={() => selectedNodeId && addChildNode(selectedNodeId, 'text')}
        title={selectedNodeId ? '선택 노드에 텍스트 자식 추가' : '먼저 노드를 클릭하세요'}
      >
        + 텍스트
      </button>
      <button
        className="px-3 py-1.5 rounded text-xs bg-indigo-800 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!selectedNodeId}
        onClick={() => selectedNodeId && addChildNode(selectedNodeId, 'table')}
        title={selectedNodeId ? '선택 노드에 테이블 자식 추가' : '먼저 노드를 클릭하세요'}
      >
        + 표
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!canUndo}
        onClick={undo}
        title="실행 취소 (Ctrl+Z)"
      >
        ↩ 실행취소
      </button>
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!canRedo}
        onClick={redo}
        title="다시 실행 (Ctrl+Y)"
      >
        ↪ 다시하기
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={applyLayout}
        title="자동 레이아웃 재정렬"
      >
        ⟳ 정렬
      </button>

      <div className="flex-1" />

      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={handleLoadJson}
      >
        📂 열기
      </button>
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={handleSaveJson}
      >
        💾 JSON 저장
      </button>
      <button
        className="px-3 py-1.5 rounded text-xs bg-emerald-700 text-white hover:bg-emerald-600"
        onClick={handleExportMarkdown}
      >
        ↓ MD 내보내기
      </button>
    </div>
  );
}
