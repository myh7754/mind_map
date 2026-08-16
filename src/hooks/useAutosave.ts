import { useEffect, useRef } from 'react';
import type { MindMapData } from '../types';
import { useMindMapStore } from '../store/useMindMapStore';
import { saveMindMap } from '../db/mindmapDB';
import { createTabSync, type TabSync } from '../db/tabSync';
import { pushMap } from '../db/cloudSync';

const AUTOSAVE_DELAY = 500;

/**
 * mindMapData/positions가 바뀌면 디바운스 후 IndexedDB에 저장한다.
 *
 * 예전에는 결과를 아무도 안 봤다. 저장이 실패해도(용량 초과, 시크릿 모드 등)
 * 화면에는 아무 변화가 없어서 사용자는 저장된 줄 알고 계속 편집했다.
 * 이제 성공/실패를 스토어에 기록하고, 성공 시 다른 탭에도 알린다.
 */
export function useAutosave(
  mindMapData: MindMapData,
  positions: Record<string, { x: number; y: number }>,
  ready: boolean
): void {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncRef = useRef<TabSync | null>(null);

  // 다른 탭의 저장을 구독한다 (마운트 1회)
  useEffect(() => {
    const sync = createTabSync((mapId) => {
      if (mapId !== useMindMapStore.getState().mindMapData.id) return;
      useMindMapStore.getState().setExternalChange(true);
    });
    syncRef.current = sync;
    return () => {
      sync.close();
      syncRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      const store = useMindMapStore.getState();
      store.setSaveStatus('saving');
      saveMindMap(mindMapData, positions)
        .then((updatedAt) => {
          useMindMapStore.getState().setSaveStatus('saved', null, updatedAt);
          syncRef.current?.notifySaved(mindMapData.id, updatedAt);
          // 로그인해 있으면 클라우드에도 올린다. 실패해도 로컬 저장은 이미 끝났으므로
          // 저장 상태를 실패로 되돌리지 않고 조용히 넘긴다 (다음 동기화가 따라잡는다).
          pushMap(mindMapData.id).catch(() => {});
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          useMindMapStore.getState().setSaveStatus('error', message);
        });
    }, AUTOSAVE_DELAY);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [mindMapData, positions, ready]);
}
