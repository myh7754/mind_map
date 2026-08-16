import { useMemo } from 'react';
import { useMindMapStore } from '../../store/useMindMapStore';
import { buildLinkIndex } from '../../utils/wikiLinks';

interface LinkPanelProps {
  nodeId: string;
}

/**
 * 노트에 쓴 [[노드 이름]]으로 만들어진 연결과 역링크.
 * 마인드맵의 트리 구조와 별개로, 노드 사이를 그래프처럼 오갈 수 있게 한다.
 */
export function LinkPanel({ nodeId }: LinkPanelProps) {
  const mindMapData = useMindMapStore((s) => s.mindMapData);
  const index = useMemo(() => buildLinkIndex(mindMapData), [mindMapData]);

  const outgoing = index.outgoing[nodeId] ?? [];
  const backlinks = index.backlinks[nodeId] ?? [];
  const unresolved = index.unresolved[nodeId] ?? [];

  const jumpTo = (id: string) => {
    const store = useMindMapStore.getState();
    store.revealNode(id); // 접힌 가지 안에 있으면 펼친다
    store.openNoteDrawer(id); // 선택 + 드로어는 열린 채로 그 노드 노트로
    store.focusNode(id, true);
  };

  const labelOf = (id: string) => mindMapData.nodes[id]?.label ?? '(삭제됨)';

  if (outgoing.length === 0 && backlinks.length === 0 && unresolved.length === 0) {
    return (
      <div className="px-4 py-2 border-t border-slate-800 text-[11px] text-slate-600">
        노트에 <code className="text-slate-500">[[노드 이름]]</code> 을 쓰면 그 노드와 연결됩니다.
      </div>
    );
  }

  const Chip = ({ id }: { id: string }) => (
    <button
      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-indigo-700 hover:text-white text-[11px] max-w-full truncate"
      onClick={() => jumpTo(id)}
      title={labelOf(id)}
    >
      {labelOf(id)}
    </button>
  );

  return (
    <div className="border-t border-slate-800 px-4 py-2 space-y-2 max-h-40 overflow-y-auto flex-shrink-0">
      {outgoing.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-1">연결 →</div>
          <div className="flex flex-wrap gap-1">
            {outgoing.map((id) => (
              <Chip key={id} id={id} />
            ))}
          </div>
        </div>
      )}

      {backlinks.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-1">← 역링크 ({backlinks.length})</div>
          <div className="flex flex-wrap gap-1">
            {backlinks.map((id) => (
              <Chip key={id} id={id} />
            ))}
          </div>
        </div>
      )}

      {unresolved.length > 0 && (
        <div>
          <div className="text-[10px] text-slate-500 mb-1">없는 노드</div>
          <div className="flex flex-wrap gap-1">
            {unresolved.map((name) => (
              <span
                key={name}
                className="px-2 py-0.5 rounded bg-slate-900 border border-dashed border-slate-700 text-slate-500 text-[11px]"
                title="이 이름의 노드가 없습니다"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
