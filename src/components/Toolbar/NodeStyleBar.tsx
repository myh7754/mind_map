import { useState } from 'react';
import { useMindMapStore } from '../../store/useMindMapStore';

// 어두운 캔버스 위에서 흰 글씨가 읽히는 채도로 고른 팔레트
const PALETTE = [
  { name: '보라', value: '#6d28d9' },
  { name: '파랑', value: '#1d4ed8' },
  { name: '청록', value: '#0e7490' },
  { name: '초록', value: '#047857' },
  { name: '노랑', value: '#a16207' },
  { name: '빨강', value: '#b91c1c' },
  { name: '분홍', value: '#be185d' },
];

/**
 * 선택한 노드의 색을 바꾼다. "가지" 를 켜면 후손까지 함께 칠해
 * 과목 안에서 주제별로 색을 나눌 수 있다.
 */
export function NodeStyleBar() {
  const selectedNodeId = useMindMapStore((s) => s.selectedNodeId);
  const setNodeColor = useMindMapStore((s) => s.setNodeColor);
  const currentColor = useMindMapStore((s) =>
    s.selectedNodeId ? s.mindMapData.nodes[s.selectedNodeId]?.style?.color : undefined
  );

  const [includeSubtree, setIncludeSubtree] = useState(false);

  if (!selectedNodeId) return null;

  return (
    <div className="flex items-center gap-1">
      {PALETTE.map((c) => (
        <button
          key={c.value}
          className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
            currentColor === c.value ? 'border-white' : 'border-slate-600'
          }`}
          style={{ background: c.value }}
          onClick={() => setNodeColor(selectedNodeId, c.value, includeSubtree)}
          title={includeSubtree ? `${c.name} (가지 전체)` : c.name}
          aria-label={c.name}
        />
      ))}
      <button
        className={`w-4 h-4 rounded-full border border-slate-600 bg-slate-700 text-[9px] leading-none text-slate-300 hover:scale-110 transition-transform ${
          currentColor ? '' : 'border-white'
        }`}
        onClick={() => setNodeColor(selectedNodeId, null, includeSubtree)}
        title="기본색으로"
        aria-label="색 없음"
      >
        ✕
      </button>

      <button
        className={`ml-1 px-1.5 py-0.5 rounded text-[10px] border ${
          includeSubtree
            ? 'bg-indigo-600 text-white border-indigo-500'
            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
        }`}
        onClick={() => setIncludeSubtree((v) => !v)}
        title="켜면 하위 노드까지 함께 칠합니다"
        aria-pressed={includeSubtree}
      >
        가지
      </button>
    </div>
  );
}
