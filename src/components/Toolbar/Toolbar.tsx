import { useMindMapStore, useUndoRedo } from '../../store/useMindMapStore';
import { SaveStatus } from './SaveStatus';
import { MapSwitcher } from './MapSwitcher';
import { NodeStyleBar } from './NodeStyleBar';
import { AccountMenu } from './AccountMenu';
import { ViewMenu } from './ViewMenu';
import { FileMenu } from './FileMenu';

export function Toolbar() {
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const addChildNode = useMindMapStore((s) => s.addChildNode);
  const applyLayout = useMindMapStore((s) => s.applyLayout);
  const setSearchOpen = useMindMapStore((s) => s.setSearchOpen);
  const setShortcutsOpen = useMindMapStore((s) => s.setShortcutsOpen);
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  return (
    // 좁은 화면에서는 버튼을 다음 줄로 흘려보낸다(flex-wrap).
    // whitespace-nowrap + [&>*]:shrink-0 = 버튼 글자가 단어 중간에 끊기거나 찌그러지지 않게.
    //
    // ⚠️ overflow-x-auto 를 다시 넣지 말 것. overflow는 한 축만 visible이 아니어도
    // 나머지 축의 visible이 auto로 바뀐다(CSS 명세) → 높이 45px인 툴바가 세로로도
    // 클리핑 컨테이너가 되어, 이 안의 드롭다운(맵 목록·보기·파일·계정)이 통째로 잘려
    // "DOM에는 있는데 화면에 안 보이는" 상태가 된다.
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700 flex-shrink-0 whitespace-nowrap [&>*]:shrink-0">
      <span className="text-indigo-400 font-semibold text-sm">🗺</span>
      <MapSwitcher />
      <div className="w-px h-5 bg-slate-700 mx-1" />

      <button
        className="px-3 py-1.5 rounded text-xs bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!selectedNodeId}
        onClick={() => selectedNodeId && addChildNode(selectedNodeId, 'text')}
        title={selectedNodeId ? '선택 노드에 텍스트 자식 추가 (Tab)' : '먼저 노드를 클릭하세요'}
      >
        ＋ 텍스트
      </button>
      <button
        className="px-3 py-1.5 rounded text-xs bg-indigo-800 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!selectedNodeId}
        onClick={() => selectedNodeId && addChildNode(selectedNodeId, 'table')}
        title={selectedNodeId ? '선택 노드에 표 자식 추가' : '먼저 노드를 클릭하세요'}
      >
        ＋ 표
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      {/* 되돌리기는 아이콘만 — 기호가 충분히 통용되고, 글자를 빼면 툴바 폭이 눈에 띄게 준다 */}
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!canUndo}
        onClick={undo}
        title="실행 취소 (Ctrl+Z)"
        aria-label="실행 취소"
      >
        ↩
      </button>
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!canRedo}
        onClick={redo}
        title="다시 실행 (Ctrl+Y)"
        aria-label="다시 실행"
      >
        ↪
      </button>

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={applyLayout}
        title="자동 레이아웃 재정렬"
        aria-label="정렬"
      >
        ⟳
      </button>
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={() => setSearchOpen(true)}
        title="노드·노트 검색 (Ctrl+F)"
      >
        🔍 검색
      </button>
      <ViewMenu />

      <div className="w-px h-5 bg-slate-700 mx-1" />
      <NodeStyleBar />

      <div className="flex-1" />

      <SaveStatus />
      <AccountMenu />

      <div className="w-px h-5 bg-slate-700 mx-1" />

      <FileMenu />
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={() => setShortcutsOpen(true)}
        title="단축키 (?)"
        aria-label="단축키"
      >
        ⌨
      </button>
    </div>
  );
}
