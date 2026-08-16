import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 클라이언트. 환경변수가 없으면 null이고, 앱은 지금까지처럼
 * 완전히 로컬로 동작한다 — 클라우드는 켜면 좋은 것이지 있어야 도는 게 아니다.
 *
 * anon 키는 클라이언트에 실려도 되는 공개 키다. 실제 접근 제어는 DB의 RLS가
 * 한다(supabase/schema.sql). service_role 키는 절대 여기 넣지 말 것.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isCloudEnabled = supabase !== null;
