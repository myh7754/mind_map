/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 프로젝트 URL. 없으면 앱은 로컬 전용으로 동작한다. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon(공개) 키. service_role 키를 넣지 말 것. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
