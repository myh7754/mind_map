import type { MindMapData } from '../types';
import { supabase } from './supabase';

/**
 * 공개 계정(showcase_owners)의 맵을 로그인 없이 읽는다.
 * 읽어도 되는지는 여기서 정하지 않는다 — RLS가 정한다(supabase/schema.sql).
 *
 * ponytail: 맵 본문을 전부 한 번에 받는다. 맵이 수십 개를 넘어 느려지면
 * 목록(id·title)과 본문을 나눠 받을 것.
 */
export async function loadShowcaseMaps(): Promise<MindMapData[]> {
  if (!supabase) return [];

  const { data: owner, error: ownerErr } = await supabase
    .from('showcase_owners')
    .select('owner_id')
    .limit(1)
    .maybeSingle();
  if (ownerErr) throw new Error(`공개 계정을 읽지 못했습니다: ${ownerErr.message}`);
  if (!owner) return [];

  const { data, error } = await supabase
    .from('maps')
    .select('data')
    .eq('owner_id', owner.owner_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`맵을 읽지 못했습니다: ${error.message}`);

  return (data ?? []).map((r) => r.data as MindMapData);
}
