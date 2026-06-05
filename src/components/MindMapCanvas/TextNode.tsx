import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindMapNode } from '../../types';
import { useMindMapStore } from '../../store/useMindMapStore';

export const TextNode = memo(function TextNode({ data, id }: NodeProps<MindMapNode>) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateNodeLabel, toggleCollapse, openNoteDrawer, deleteNode, mindMapData } =
    useMindMapStore();

  const hasChildren = (mindMapData.children[id] ?? []).length > 0;

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (label !== data.label) updateNodeLabel(id, label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      (e.target as HTMLElement).blur();
    }
  };

  return (
    <div
      className="relative group flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium select-none"
      style={{
        background: data.style?.color ?? '#1e293b',
        borderColor: data.style?.color ? data.style.color + '80' : '#334155',
        color: '#e2e8f0',
        minWidth: 120,
      }}
      onDoubleClick={() => setEditing(true)}
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

      <div className="hidden group-hover:flex items-center gap-1 ml-1">
        <button
          className="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-500"
          onClick={(e) => { e.stopPropagation(); openNoteDrawer(id); }}
          title="노트 열기"
        >
          📝
        </button>
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
