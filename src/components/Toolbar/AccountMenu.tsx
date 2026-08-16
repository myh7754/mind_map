import { useState } from 'react';
import { useAuth, signInWith, signOut } from '../../hooks/useAuth';
import { syncNow } from '../../db/cloudSync';
import { useMindMapStore } from '../../store/useMindMapStore';
import { listMaps, loadMindMap } from '../../db/mindmapDB';

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

/**
 * 로그인 / 동기화 메뉴.
 * 클라우드가 꺼져 있으면(환경변수 없음) 아무것도 그리지 않는다 — 로컬 전용 앱 그대로.
 */
export function AccountMenu() {
  const { session, ready, cloudEnabled } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<SyncState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  if (!cloudEnabled || !ready) return null;

  const runSync = async () => {
    setState('syncing');
    setMessage(null);
    try {
      const result = await syncNow();
      if (!result) {
        setState('idle');
        return;
      }
      setState('done');
      setMessage(
        `올림 ${result.pushed} · 받음 ${result.pulled} · 삭제 ${result.deletedLocal + result.deletedRemote}`
      );

      // 내려받은 내용이 있으면 지금 보고 있는 맵을 새로 읽어 화면에 반영한다
      if (result.pulled > 0 || result.deletedLocal > 0) {
        const store = useMindMapStore.getState();
        const maps = await listMaps();
        const current = maps.find((m) => m.id === store.mindMapData.id) ?? maps[0];
        if (current) {
          const persisted = await loadMindMap(current.id);
          if (persisted) store.openMap(persisted.mindMapData, persisted.positions);
        }
      }
    } catch (e) {
      setState('error');
      setMessage((e as Error).message);
    }
  };

  const handleSignIn = async (provider: 'github' | 'google') => {
    try {
      await signInWith(provider);
    } catch (e) {
      setState('error');
      setMessage((e as Error).message);
    }
  };

  // ── 비로그인 ──
  if (!session) {
    return (
      <div className="relative">
        <button
          className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
          onClick={() => setIsOpen((v) => !v)}
          title="로그인하면 기기 간에 동기화됩니다"
        >
          ☁ 로그인
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full right-0 mt-1 z-40 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-2 space-y-1">
              <div className="text-[10px] text-slate-500 px-1 pb-1">
                로그인하면 지금 이 브라우저의 맵이 클라우드로 올라가고, 다른 기기에서도 이어서
                볼 수 있습니다.
              </div>
              <button
                className="w-full px-2 py-1.5 rounded text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 text-left"
                onClick={() => handleSignIn('github')}
              >
                GitHub 로 계속하기
              </button>
              <button
                className="w-full px-2 py-1.5 rounded text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 text-left"
                onClick={() => handleSignIn('google')}
              >
                Google 로 계속하기
              </button>
              {state === 'error' && (
                <div className="text-[10px] text-red-300 px-1">{message}</div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── 로그인 상태 ──
  const email = session.user.email ?? session.user.user_metadata?.name ?? '계정';

  return (
    <div className="relative flex items-center gap-1">
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"
        onClick={runSync}
        disabled={state === 'syncing'}
        title="지금 동기화"
      >
        {state === 'syncing' ? '⟳ 동기화 중…' : '⟳ 동기화'}
      </button>
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 max-w-[10rem] truncate"
        onClick={() => setIsOpen((v) => !v)}
        title={email}
      >
        {email}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-40 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-2 space-y-1">
            <div className="text-[10px] text-slate-500 px-1 truncate">{email}</div>
            {message && (
              <div
                className={`text-[10px] px-1 ${state === 'error' ? 'text-red-300' : 'text-slate-500'}`}
              >
                {message}
              </div>
            )}
            <button
              className="w-full px-2 py-1.5 rounded text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 text-left"
              onClick={async () => {
                setIsOpen(false);
                await signOut();
              }}
            >
              로그아웃
            </button>
            <div className="text-[10px] text-slate-600 px-1">
              로그아웃해도 이 브라우저의 맵은 남습니다.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
