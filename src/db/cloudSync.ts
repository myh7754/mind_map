import type { MindMapData, PersistedState } from '../types';
import { supabase } from './supabase';
import { planSync, type SyncEntry } from '../utils/syncMerge';
import {
  listSyncEntries,
  loadMindMap,
  purgeMap,
  writeMapFromCloud,
} from './mindmapDB';

const TABLE = 'maps';

interface RemoteRow {
  id: string;
  owner_id: string;
  title: string;
  data: MindMapData;
  positions: Record<string, { x: number; y: number }>;
  updated_at: string;
  deleted_at: string | null;
}

const toMillis = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);

export interface SyncResult {
  pushed: number;
  pulled: number;
  deletedLocal: number;
  deletedRemote: number;
}

/**
 * 로컬과 클라우드를 한 번 맞춘다.
 *
 * 판단은 전부 planSync(순수 함수)가 하고, 여기서는 그 계획을 실행만 한다.
 * 로그인하지 않았거나 클라우드가 꺼져 있으면 아무 일도 하지 않는다.
 */
export async function syncNow(): Promise<SyncResult | null> {
  if (!supabase) return null;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { data: rows, error } = await supabase
    .from(TABLE)
    .select('id, owner_id, title, data, positions, updated_at, deleted_at');
  if (error) throw new Error(`클라우드 목록을 읽지 못했습니다: ${error.message}`);

  const remoteRows = (rows ?? []) as RemoteRow[];
  const remoteById = new Map(remoteRows.map((r) => [r.id, r]));

  const remote: SyncEntry[] = remoteRows.map((r) => ({
    id: r.id,
    updatedAt: toMillis(r.updated_at),
    deletedAt: r.deleted_at ? toMillis(r.deleted_at) : null,
  }));
  const local = await listSyncEntries();

  const plan = planSync(local, remote);

  // ── 올리기 ──
  for (const id of plan.push) {
    const record = await loadMindMap(id);
    if (!record) continue;
    const { error: upErr } = await supabase.from(TABLE).upsert({
      id,
      owner_id: userId,
      title: record.mindMapData?.title ?? '',
      data: record.mindMapData,
      positions: record.positions ?? {},
      updated_at: new Date(record.updatedAt ?? Date.now()).toISOString(),
      deleted_at: null,
    });
    if (upErr) throw new Error(`업로드 실패(${id}): ${upErr.message}`);
  }

  // ── 내리기 ──
  for (const id of plan.pull) {
    const row = remoteById.get(id);
    if (!row) continue;
    const record: PersistedState & { id: string } = {
      id,
      mindMapData: row.data,
      positions: row.positions ?? {},
      updatedAt: toMillis(row.updated_at),
    };
    await writeMapFromCloud(record);
  }

  // ── 클라우드에서 지우기 (로컬 삭제 전파) ──
  for (const id of plan.deleteRemote) {
    const localEntry = local.find((e) => e.id === id);
    const { error: delErr } = await supabase.from(TABLE).upsert({
      id,
      owner_id: userId,
      title: '',
      data: {},
      positions: {},
      updated_at: new Date(localEntry?.updatedAt ?? Date.now()).toISOString(),
      deleted_at: new Date(localEntry?.deletedAt ?? Date.now()).toISOString(),
    });
    if (delErr) throw new Error(`클라우드 삭제 실패(${id}): ${delErr.message}`);
  }

  // ── 로컬에서 지우기 (클라우드 삭제 전파) ──
  for (const id of plan.deleteLocal) {
    await purgeMap(id);
  }

  return {
    pushed: plan.push.length,
    pulled: plan.pull.length,
    deletedLocal: plan.deleteLocal.length,
    deletedRemote: plan.deleteRemote.length,
  };
}

/** 맵 하나만 즉시 올린다 (자동 저장 직후 호출) */
export async function pushMap(mapId: string): Promise<void> {
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  const record = await loadMindMap(mapId);
  if (!record || record.deletedAt) return;

  const { error } = await supabase.from(TABLE).upsert({
    id: mapId,
    owner_id: userId,
    title: record.mindMapData?.title ?? '',
    data: record.mindMapData,
    positions: record.positions ?? {},
    updated_at: new Date(record.updatedAt ?? Date.now()).toISOString(),
    deleted_at: null,
  });
  if (error) throw new Error(`업로드 실패: ${error.message}`);
}
