import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isCloudEnabled } from '../db/supabase';

export interface AuthState {
  session: Session | null;
  /** 최초 세션 확인이 끝났는지. 끝나기 전에 로그인 버튼을 깜빡이지 않게 한다. */
  ready: boolean;
  cloudEnabled: boolean;
}

/**
 * Supabase 세션을 구독한다.
 * 클라우드가 꺼져 있으면(환경변수 없음) 항상 비로그인 상태로 조용히 동작한다.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isCloudEnabled);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, ready, cloudEnabled: isCloudEnabled };
}

export async function signInWith(provider: 'github' | 'google'): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(`로그인 실패: ${error.message}`);
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
