import { useEffect, useState } from 'react';
import type { MapSummary } from '../../types';
import { useMindMapStore, createEmptyMindMap } from '../../store/useMindMapStore';
import { listMaps, loadMindMap, deleteMap, saveMindMap } from '../../db/mindmapDB';

function formatDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString([], { month: 'numeric', day: 'numeric' });
}

/**
 * 과목별 마인드맵 전환기.
 * 제목 인라인 편집 + 맵 목록 + 새로 만들기 + 삭제.
 */
export function MapSwitcher() {
  const mindMapData = useMindMapStore((s) => s.mindMapData);
  const positions = useMindMapStore((s) => s.positions);
  const openMap = useMindMapStore((s) => s.openMap);
  const setMapTitle = useMindMapStore((s) => s.setMapTitle);

  const [isOpen, setIsOpen] = useState(false);
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    listMaps().then(setMaps);
  }, [isOpen]);

  // 삭제 확인 상태는 열고 닫을 때 이벤트에서 초기화한다 (effect에서 하면 렌더가 연쇄된다)
  const toggle = () => {
    setIsOpen((v) => !v);
    setConfirmId(null);
  };

  /**
   * 자동 저장은 500ms 디바운스라, 편집 직후 맵을 바꾸면 대기 중이던 저장이
   * 취소되면서 그 편집이 사라진다. 떠나기 전에 반드시 확정 저장한다.
   */
  const flushCurrent = () => saveMindMap(mindMapData, positions);

  const switchTo = async (id: string) => {
    setIsOpen(false);
    if (id === mindMapData.id) return;
    await flushCurrent();
    const persisted = await loadMindMap(id);
    if (persisted) openMap(persisted.mindMapData, persisted.positions);
  };

  const createNew = async () => {
    setIsOpen(false);
    await flushCurrent();
    openMap(createEmptyMindMap('새 과목'), {});
  };

  const remove = async (id: string) => {
    await deleteMap(id);
    const rest = await listMaps();
    setMaps(rest);
    setConfirmId(null);

    // 지금 보고 있는 맵을 지웠으면 다른 맵으로 옮겨간다 (없으면 새로 하나 만든다)
    if (id === mindMapData.id) {
      setIsOpen(false);
      const next = rest[0] ? await loadMindMap(rest[0].id) : undefined;
      if (next) openMap(next.mindMapData, next.positions);
      else openMap(createEmptyMindMap('새 마인드맵'), {});
    }
  };

  return (
    <div className="relative flex items-center gap-1">
      <input
        className="bg-transparent text-sm font-semibold text-slate-200 outline-none rounded px-1.5 py-0.5 w-36 hover:bg-slate-800 focus:bg-slate-800"
        value={mindMapData.title}
        onChange={(e) => setMapTitle(e.target.value)}
        title="맵 이름 (과목명)"
        aria-label="맵 이름"
      />
      <button
        className="px-1.5 py-1 rounded text-xs text-slate-400 hover:bg-slate-700"
        onClick={toggle}
        title="다른 마인드맵 열기"
        aria-label="맵 목록"
        aria-expanded={isOpen}
      >
        ▾
      </button>

      {isOpen && (
        <>
          {/* 바깥 클릭으로 닫기 */}
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />

          <div className="absolute top-full left-0 mt-1 z-40 w-64 rounded-lg border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto">
              {maps.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-500 text-center">저장된 맵 없음</div>
              ) : (
                maps.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-slate-800 last:border-b-0 hover:bg-slate-800 ${
                      m.id === mindMapData.id ? 'bg-slate-800' : ''
                    }`}
                  >
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => switchTo(m.id)}
                    >
                      <div className="text-sm text-slate-200 truncate">
                        {m.id === mindMapData.id && '✓ '}
                        {m.title}
                      </div>
                      <div className="text-[10px] text-slate-500">{formatDate(m.updatedAt)}</div>
                    </button>

                    {confirmId === m.id ? (
                      <button
                        className="text-[10px] px-1.5 py-0.5 rounded bg-red-700 text-white hover:bg-red-600 whitespace-nowrap"
                        onClick={() => remove(m.id)}
                      >
                        정말 삭제
                      </button>
                    ) : (
                      <button
                        className="text-xs text-slate-500 hover:text-red-400 px-1"
                        onClick={() => setConfirmId(m.id)}
                        title="삭제"
                        aria-label={`${m.title} 삭제`}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              className="w-full px-3 py-2 text-xs text-indigo-300 hover:bg-slate-800 border-t border-slate-700 text-left"
              onClick={createNew}
            >
              ＋ 새 과목 만들기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
