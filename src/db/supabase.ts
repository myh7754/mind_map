import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 클라이언트. 환경변수가 없으면 null이고, 앱은 지금까지처럼
 * 완전히 로컬로 동작한다 — 클라우드는 켜면 좋은 것이지 있어야 도는 게 아니다.
 *
 * publishable 키는 클라이언트에 실려도 되는 공개 키다. 실제 접근 제어는 DB의 RLS가
 * 한다(supabase/schema.sql). secret·service_role 키는 절대 여기 넣지 말 것.
 *
 * 값은 커밋된 .env.production에서 온다. 예전 이름(VITE_SUPABASE_ANON_KEY)을 쓰지 않는 이유:
 * Vercel에 그 이름으로 삭제된 secret 키가 남아 있고, 호스트 환경변수가 .env 파일보다 우선한다.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isCloudEnabled = supabase !== null;
