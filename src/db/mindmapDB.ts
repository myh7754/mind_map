import { openDB, type IDBPDatabase } from 'idb';
import type { MindMapData, MapSummary, PersistedState } from '../types';

const DB_NAME = 'mindmap-db';
const STORE_NAME = 'maps';
const DB_VERSION = 1;

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
}

/**
 * 저장하고 저장 시각을 돌려준다.
 * 호출부는 이 시각을 기억해 뒀다가, 다른 탭이 더 나중에 저장했는지 판단하는 데 쓴다.
 * 실패(용량 초과, 시크릿 모드, 브라우저 정책 등)는 그대로 던진다 — 조용히 삼키면
 * 사용자는 저장된 줄 알고 계속 편집하다가 새로고침에서 잃는다.
 */
export async function saveMindMap(
  mindMapData: MindMapData,
  positions: Record<string, { x: number; y: number }>
): Promise<number> {
  const db = await getDB();
  const updatedAt = Date.now();
  const record: PersistedState & { id: string } = {
    id: mindMapData.id,
    mindMapData,
    positions,
    updatedAt,
  };
  await db.put(STORE_NAME, record);
  return updatedAt;
}

export async function loadMindMap(id: string): Promise<PersistedState | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/**
 * 저장된 마인드맵 목록 (최근 수정순).
 *
 * ponytail: getAll()로 레코드를 통째로 읽어 목록을 만든다. 맵이 수십 개 수준이면
 * 충분하다. 맵 수/크기가 커져 느려지면 title·updatedAt만 담는 meta 스토어를
 * 따로 두고 저장 시 같이 갱신하면 된다.
 */
export async function listMaps(): Promise<MapSummary[]> {
  const db = await getDB();
  const all: (PersistedState & { id: string })[] = await db.getAll(STORE_NAME);
  return all
    .map((r) => ({
      id: r.id,
      title: r.mindMapData?.title ?? '제목 없음',
      updatedAt: r.updatedAt ?? 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteMap(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
