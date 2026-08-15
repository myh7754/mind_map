import { nanoid } from 'nanoid';

/**
 * 같은 브라우저에서 이 앱을 여러 탭으로 열었을 때의 덮어쓰기 감지.
 *
 * 모든 탭이 같은 IndexedDB 키('default')에 500ms 디바운스로 자동 저장하기 때문에,
 * 아무 조치가 없으면 마지막에 저장한 탭이 조용히 이깁니다. 여기서는 저장할 때마다
 * 다른 탭에 알려서, 받은 쪽이 사용자에게 "다른 탭이 이 맵을 바꿨다"고 알릴 수 있게 한다.
 *
 * 자동 병합은 하지 않는다 — 트리 구조 병합은 사용자 의도를 추측해야 하고,
 * 잘못 추측하면 조용한 덮어쓰기보다 더 나쁘다. 감지해서 알리고 선택은 사용자에게 맡긴다.
 */
const CHANNEL_NAME = 'mindmap-sync';

/** 이 탭의 고유 id. 자기가 보낸 메시지를 무시하는 데 쓴다. */
export const TAB_ID = nanoid(6);

interface SavedMessage {
  type: 'saved';
  tabId: string;
  mapId: string;
  updatedAt: number;
}

export interface TabSync {
  /** 저장 성공을 다른 탭에 알린다 */
  notifySaved: (mapId: string, updatedAt: number) => void;
  close: () => void;
}

/**
 * @param onExternalSave 다른 탭이 저장했을 때 호출된다 (자기 자신의 저장은 제외)
 */
export function createTabSync(
  onExternalSave: (mapId: string, updatedAt: number) => void
): TabSync {
  // jsdom 등 BroadcastChannel이 없는 환경에서는 조용히 무력화한다
  if (typeof BroadcastChannel === 'undefined') {
    return { notifySaved: () => {}, close: () => {} };
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);

  channel.onmessage = (event: MessageEvent<SavedMessage>) => {
    const msg = event.data;
    if (!msg || msg.type !== 'saved') return;
    if (msg.tabId === TAB_ID) return; // 내가 보낸 것
    onExternalSave(msg.mapId, msg.updatedAt);
  };

  return {
    notifySaved: (mapId, updatedAt) => {
      const msg: SavedMessage = { type: 'saved', tabId: TAB_ID, mapId, updatedAt };
      channel.postMessage(msg);
    },
    close: () => channel.close(),
  };
}
