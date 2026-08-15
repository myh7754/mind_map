import { useMindMapStore } from '../../store/useMindMapStore';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * 자동 저장 상태 표시. 성공은 조용히, 실패는 눈에 띄게.
 * (저장이 실패했는데 아무 표시가 없으면 사용자는 저장된 줄 알고 계속 작업한다)
 */
export function SaveStatus() {
  const saveStatus = useMindMapStore((s) => s.saveStatus);
  const saveError = useMindMapStore((s) => s.saveError);
  const lastSavedAt = useMindMapStore((s) => s.lastSavedAt);

  if (saveStatus === 'error') {
    return (
      <span
        className="flex items-center gap-1 text-[11px] text-red-300 bg-red-950/60 border border-red-800 rounded px-2 py-1"
        title={saveError ?? '알 수 없는 오류'}
        role="status"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        저장 실패
      </span>
    );
  }

  if (saveStatus === 'saving') {
    return (
      <span className="flex items-center gap-1 text-[11px] text-slate-500" role="status">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        저장 중…
      </span>
    );
  }

  if (saveStatus === 'saved' && lastSavedAt) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-slate-600" role="status">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {formatTime(lastSavedAt)} 저장됨
      </span>
    );
  }

  return null;
}
