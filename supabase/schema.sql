-- 마인드맵 클라우드 저장 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

create table if not exists public.maps (
  -- 앱이 만드는 nanoid를 그대로 쓴다. 전역 고유값이라 사용자가 섞여도 안전하다.
  id          text        primary key,
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  title       text        not null default '',
  -- mindMapData 전체 (nodes, children, rootId ...)
  data        jsonb       not null,
  positions   jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  -- 소프트 삭제. 실제로 지우면 다른 기기가 "여긴 없네" 하고 되살려 올린다.
  deleted_at  timestamptz
);

-- 내 맵 목록 조회가 가장 잦은 쿼리
create index if not exists maps_owner_updated_idx
  on public.maps (owner_id, updated_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security: "각자 자기 맵만" 을 앱이 아니라 DB가 강제한다.
-- 앱 쿼리에 실수가 있어도 남의 행이 새지 않는다.
-- ─────────────────────────────────────────────────────────────
alter table public.maps enable row level security;

drop policy if exists "본인 맵만 조회" on public.maps;
create policy "본인 맵만 조회"
  on public.maps for select
  using (auth.uid() = owner_id);

drop policy if exists "본인 맵만 생성" on public.maps;
create policy "본인 맵만 생성"
  on public.maps for insert
  with check (auth.uid() = owner_id);

drop policy if exists "본인 맵만 수정" on public.maps;
create policy "본인 맵만 수정"
  on public.maps for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "본인 맵만 삭제" on public.maps;
create policy "본인 맵만 삭제"
  on public.maps for delete
  using (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────
-- 공개 계정(포트폴리오): 여기 등록된 계정의 맵은 로그인 없이 누구나 "읽는다".
-- 수정·삭제 정책은 위의 "본인만" 그대로라 쓰기는 여전히 본인만 된다.
-- (같은 동작의 정책이 여럿이면 OR로 합쳐진다 — select만 넓어진다)
--
-- 등록: 본인 계정으로 앱에 한 번 로그인한 뒤 SQL Editor에서 실행
--   insert into public.showcase_owners (owner_id)
--   select id from auth.users where email = '본인 이메일';
-- ─────────────────────────────────────────────────────────────
create table if not exists public.showcase_owners (
  owner_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.showcase_owners enable row level security;

-- 쓰기 정책은 일부러 없다 → 앱(publishable 키)으로는 아무도 스스로를 공개 계정으로 못 올린다
drop policy if exists "공개 계정 목록은 누구나 조회" on public.showcase_owners;
create policy "공개 계정 목록은 누구나 조회"
  on public.showcase_owners for select
  using (true);

drop policy if exists "공개 계정 맵은 누구나 조회" on public.maps;
create policy "공개 계정 맵은 누구나 조회"
  on public.maps for select
  using (owner_id in (select owner_id from public.showcase_owners));
