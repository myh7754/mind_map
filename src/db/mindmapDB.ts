import { openDB, type IDBPDatabase } from 'idb';
import type { MindMapData, PersistedState } from '../types';

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

export async function saveMindMap(
  mindMapData: MindMapData,
  positions: Record<string, { x: number; y: number }>
): Promise<void> {
  const db = await getDB();
  const record: PersistedState & { id: string } = {
    id: mindMapData.id,
    mindMapData,
    positions,
  };
  await db.put(STORE_NAME, record);
}

export async function loadMindMap(id: string): Promise<PersistedState | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}
