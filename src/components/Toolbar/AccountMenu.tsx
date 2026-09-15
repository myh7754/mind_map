import { useState } from 'react';
import { useAuth, signInWith, signOut } from '../../hooks/useAuth';
import { syncNow } from '../../db/cloudSync';
import { useMindMapStore } from '../../store/useMindMapStore';
import { listMaps, loadMindMap } from '../../db/mindmapDB';

type SyncState = 'idle' | 'syncing' | 'done' | 'error';

// 드롭다운은 툴바(whitespace-nowrap) 안에 있어 줄바꿈 금지를 물려받는다.
// 그대로 두면 안내 문장이 한 줄로 늘어나고, 버튼(inline 요소)이 가로로 붙어 화면 밖으로 밀려난다.
const PANEL =
  'absolute top-full right-0 mt-1 z-40 w-64 whitespace-normal rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-3';

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
          aria-expanded={isOpen}
        >
          ☁ 로그인
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <div className={PANEL}>
              <div className="text-sm font-semibold text-slate-100">로그인</div>
              <p className="mt-1 mb-3 text-[11px] leading-relaxed text-slate-400">
                로그인하면 내 계정에 맵을 만들고 편집할 수 있습니다. 다른 기기에서도 이어서 볼 수
                있습니다.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#24292f] text-xs font-medium text-white hover:bg-[#32383f] border border-slate-600"
                  onClick={() => handleSignIn('github')}
                >
                  <GitHubIcon />
                  GitHub로 계속하기
                </button>
                <button
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-white text-xs font-medium text-slate-800 hover:bg-slate-100 border border-slate-300"
                  onClick={() => handleSignIn('google')}
                >
                  <GoogleIcon />
                  Google로 계속하기
                </button>
              </div>
              {state === 'error' && (
                <div className="mt-2 text-[11px] text-red-300 break-words">{message}</div>
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
          <div className={PANEL}>
            <div className="text-[11px] text-slate-500 truncate">{email}</div>
            {message && (
              <div
                className={`mt-1 text-[11px] break-words ${state === 'error' ? 'text-red-300' : 'text-slate-500'}`}
              >
                {message}
              </div>
            )}
            <button
              className="mt-2 flex h-8 w-full items-center justify-center rounded-md bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
              onClick={async () => {
                setIsOpen(false);
                await signOut();
              }}
            >
              로그아웃
            </button>
            <div className="mt-1 text-[10px] text-slate-600">로그아웃해도 이 브라우저의 맵은 남습니다.</div>
          </div>
        </>
      )}
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
