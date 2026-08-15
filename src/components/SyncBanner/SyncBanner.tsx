import { useMindMapStore } from '../../store/useMindMapStore';
import { loadMindMap } from '../../db/mindmapDB';

/**
 * 다른 탭이 같은 마인드맵을 저장했을 때 알리는 배너.
 *
 * 자동으로 덮어쓰거나 자동으로 병합하지 않는다. 둘 다 사용자 의도를 추측하는 일이고,
 * 틀리면 조용히 작업을 날린다. 대신 "이런 일이 있었다"를 알리고 선택지를 준다.
 */
export function SyncBanner() {
  const hasExternalChange = useMindMapStore((s) => s.hasExternalChange);
  const setExternalChange = useMindMapStore((s) => s.setExternalChange);
  const loadFromPersisted = useMindMapStore((s) => s.loadFromPersisted);
  const mapId = useMindMapStore((s) => s.mindMapData.id);

  if (!hasExternalChange) return null;

  const handleReload = async () => {
    const persisted = await loadMindMap(mapId);
    if (persisted) {
      loadFromPersisted(persisted.mindMapData, persisted.positions);
    }
    setExternalChange(false);
  };

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-lg border border-amber-700 bg-amber-950/95 px-4 py-2 shadow-xl backdrop-blur"
      role="alert"
    >
      <span className="text-sm">⚠️</span>
      <span className="text-xs text-amber-100">
        다른 탭에서 이 마인드맵을 수정했습니다. 계속 편집하면 이 탭의 내용이 덮어씁니다.
      </span>
      <button
        className="px-2 py-1 rounded text-xs bg-amber-600 text-white hover:bg-amber-500 whitespace-nowrap"
        onClick={handleReload}
      >
        다시 불러오기
      </button>
      <button
        className="text-amber-300 hover:text-amber-100 text-sm leading-none"
        onClick={() => setExternalChange(false)}
        title="무시"
      >
        ✕
      </button>
    </div>
  );
}
