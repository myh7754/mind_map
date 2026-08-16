import { useMindMapStore, useUndoRedo } from '../../store/useMindMapStore';
import { exportToMarkdown } from '../../utils/exportMarkdown';
import { downloadJson, loadJsonFile } from '../../utils/exportJson';
import { saveAs } from 'file-saver';
import { importFromMarkdown, pickTextFile } from '../../utils/importMarkdown';
import { exportToPng } from '../../utils/exportImage';
import { SaveStatus } from './SaveStatus';
import { MapSwitcher } from './MapSwitcher';
import { NodeStyleBar } from './NodeStyleBar';
import { AccountMenu } from './AccountMenu';

export function Toolbar() {
  const {
    mindMapData,
    rfNodes,
    selectedNodeId,
    addChildNode,
    applyLayout,
    loadFromPersisted,
    openMap,
    setSearchOpen,
  } = useMindMapStore();
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

  // 가져온 마크다운은 새 맵으로 연다 (지금 보던 과목을 덮어쓰지 않는다)
  const handleImportMarkdown = async () => {
    try {
      const { name, text } = await pickTextFile('.md,.markdown,.txt');
      const fallback = name.replace(/\.(md|markdown|txt)$/i, '');
      openMap(importFromMarkdown(text, fallback), {});
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleExportPng = async () => {
    try {
      await exportToPng(rfNodes, mindMapData.title);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    // 좁은 화면에서는 버튼을 다음 줄로 흘려보낸다(flex-wrap).
    // whitespace-nowrap + [&>*]:shrink-0 = 버튼 글자가 단어 중간에 끊기거나 찌그러지지 않게.
    //
    // ⚠️ overflow-x-auto 를 다시 넣지 말 것. overflow는 한 축만 visible이 아니어도
    // 나머지 축의 visible이 auto로 바뀐다(CSS 명세) → 높이 45px인 툴바가 세로로도
    // 클리핑 컨테이너가 되어, 이 안의 드롭다운(맵 목록·계정 메뉴)이 통째로 잘려
    // "DOM에는 있는데 화면에 안 보이는" 상태가 된다.
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0 whitespace-nowrap [&>*]:shrink-0">
      <span className="text-indigo-400 font-semibold text-sm">🗺</span>
      <MapSwitcher />
      <div className="w-px h-5 bg-slate-700 mx-1" />

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
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={() => setSearchOpen(true)}
        title="노드·노트 검색 (Ctrl+F)"
      >
        🔍 검색
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />
      <NodeStyleBar />

      <div className="flex-1" />

      {/* 폭을 많이 먹는다. 2xl(1536px)로는 부족해서 — 딱 1536 화면에서 툴바가 잘렸다 —
          나머지 버튼이 다 들어가고도 남는 1800px 이상에서만 보인다. */}
      <span className="text-[10px] text-slate-600 mr-2 hidden min-[1800px]:inline">
        Tab 자식 · Enter 형제 · F2 편집 · ←↑↓→ 이동 · Space 접기
      </span>

      <SaveStatus />
      <AccountMenu />

      <div className="w-px h-5 bg-slate-700 mx-1" />

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
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={handleImportMarkdown}
        title="마크다운 아웃라인을 새 맵으로 가져오기"
      >
        📥 MD 가져오기
      </button>
      <button
        className="px-3 py-1.5 rounded text-xs bg-emerald-700 text-white hover:bg-emerald-600"
        onClick={handleExportMarkdown}
      >
        ↓ MD 내보내기
      </button>
      <button
        className="px-3 py-1.5 rounded text-xs bg-emerald-800 text-white hover:bg-emerald-700"
        onClick={handleExportPng}
        title="보이는 노드 전체를 PNG로 저장"
      >
        🖼 PNG
      </button>
    </div>
  );
}
