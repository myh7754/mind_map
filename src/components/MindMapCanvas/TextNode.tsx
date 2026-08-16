import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindMapNode } from '../../types';
import { useMindMapStore } from '../../store/useMindMapStore';
import { hasNoteContent } from '../../utils/noteText';

export const TextNode = memo(function TextNode({ data, id, selected }: NodeProps<MindMapNode>) {
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateNodeLabel, toggleCollapse, openNoteDrawer, deleteNode, mindMapData, editingNodeId, setEditingNodeId } =
    useMindMapStore();

  // 편집 상태는 스토어가 단일 출처: 더블클릭/F2/Tab·Enter(생성 직후) 모두 여기로 모인다.
  const editing = editingNodeId === id;
  const hasChildren = (mindMapData.children[id] ?? []).length > 0;
  const noted = hasNoteContent(data.note);

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  useEffect(() => {
    if (editing) {
      // 새로 만든 '새 노드'는 전체 선택해두면 바로 타이핑으로 덮어쓸 수 있다.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleBlur = () => {
    setEditingNodeId(null);
    if (label !== data.label) updateNodeLabel(id, label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      (e.target as HTMLElement).blur();
    }
  };

  return (
    <div
      className={`relative group flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium select-none ${
        selected ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-950' : ''
      }`}
      style={{
        background: data.style?.color ?? '#1e293b',
        borderColor: data.style?.color ? data.style.color + '80' : '#334155',
        color: '#e2e8f0',
        minWidth: 120,
      }}
      onDoubleClick={() => setEditingNodeId(id)}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />

      {editing ? (
        <input
          ref={inputRef}
          className="bg-transparent outline-none w-full text-white"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <span className="flex-1">{data.label}</span>
      )}

      {/* 내용이 있는 노트는 항상 표시한다 — 펼치지 않고도 "여기 뭔가 적혀 있다"를 알 수 있게.
          hover 시 숨기지 않는 이유: 노드 폭이 바뀌면 실측 크기가 달라져 배치가 다시 계산된다
          (useMindMapStore의 onRfNodesChange). 마우스만 올려도 맵이 출렁이게 된다. */}
      {noted && (
        <button
          className="shrink-0 text-[11px] leading-none opacity-80 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); openNoteDrawer(id); }}
          title="노트 보기"
          aria-label="노트 있음"
        >
          📝
        </button>
      )}

      <div className="hidden group-hover:flex items-center gap-1 ml-1">
        {!noted && (
          <button
            className="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-500"
            onClick={(e) => { e.stopPropagation(); openNoteDrawer(id); }}
            title="노트 열기"
          >
            📝
          </button>
        )}
        <button
          className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-white hover:bg-slate-500"
          onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
          title="삭제"
        >
          ✕
        </button>
      </div>

      {hasChildren && (
        <button
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-700 border border-slate-500 text-xs flex items-center justify-center text-slate-300 hover:bg-slate-600 z-10"
          onClick={(e) => { e.stopPropagation(); toggleCollapse(id); }}
          title={data.collapsed ? '펼치기' : '접기'}
        >
          {data.collapsed ? '+' : '−'}
        </button>
      )}

      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
});
