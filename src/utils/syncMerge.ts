/**
 * 로컬(IndexedDB)과 클라우드(Supabase) 맵 목록을 대조해 무엇을 올리고 내리고
 * 지울지 정하는 순수 함수.
 *
 * 네트워크와 분리해 둔 이유: 동기화는 데이터 유실이 사는 자리라, 판단 로직만은
 * 실제 서버 없이 전부 테스트할 수 있어야 한다.
 *
 * 정책: **맵 단위 last-write-wins**. updatedAt이 더 최신인 쪽이 이긴다.
 * 노드 단위 병합은 하지 않는다 — 같은 노드를 양쪽에서 다르게 고쳤을 때
 * 무엇이 옳은지 추측해야 하고, 틀리면 조용히 작업을 뭉갠다.
 */

export interface SyncEntry {
  id: string;
  updatedAt: number;
  /** 삭제된 맵. 삭제도 하나의 "변경"이라 시각을 함께 본다. */
  deletedAt?: number | null;
}

export interface SyncPlan {
  /** 로컬 → 클라우드로 올릴 맵 id */
  push: string[];
  /** 클라우드 → 로컬로 내릴 맵 id */
  pull: string[];
  /** 로컬에서 지울 맵 id (클라우드에서 삭제됨) */
  deleteLocal: string[];
  /** 클라우드에서 지울 맵 id (로컬에서 삭제됨) */
  deleteRemote: string[];
}

/** 이 맵의 마지막 변경 시각 (삭제도 변경이다) */
function changedAt(entry: SyncEntry): number {
  return Math.max(entry.updatedAt ?? 0, entry.deletedAt ?? 0);
}

function isDeleted(entry: SyncEntry | undefined): boolean {
  return !!entry?.deletedAt;
}

/**
 * @param local  로컬에 있는 맵들 (소프트 삭제 표시 포함)
 * @param remote 클라우드에 있는 맵들 (소프트 삭제 표시 포함)
 */
export function planSync(local: SyncEntry[], remote: SyncEntry[]): SyncPlan {
  const localById = new Map(local.map((e) => [e.id, e]));
  const remoteById = new Map(remote.map((e) => [e.id, e]));

  const plan: SyncPlan = { push: [], pull: [], deleteLocal: [], deleteRemote: [] };
  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);

  for (const id of allIds) {
    const l = localById.get(id);
    const r = remoteById.get(id);

    // 한쪽에만 있는 경우
    if (l && !r) {
      // 로컬에서 이미 지운 맵이 클라우드에 없다면 할 일 없음
      if (!isDeleted(l)) plan.push.push(id);
      continue;
    }
    if (r && !l) {
      // 클라우드에서 지워진 맵을 굳이 내려받지 않는다
      if (!isDeleted(r)) plan.pull.push(id);
      continue;
    }
    if (!l || !r) continue;

    // 양쪽에 있는 경우 — 더 최근에 변경된 쪽이 이긴다
    const lt = changedAt(l);
    const rt = changedAt(r);
    if (lt === rt) continue; // 같으면 손대지 않는다

    const localWins = lt > rt;
    if (localWins) {
      if (isDeleted(l)) plan.deleteRemote.push(id);
      else plan.push.push(id);
    } else {
      if (isDeleted(r)) plan.deleteLocal.push(id);
      else plan.pull.push(id);
    }
  }

  // 순서를 고정해 테스트와 로그를 읽기 쉽게 한다
  plan.push.sort();
  plan.pull.sort();
  plan.deleteLocal.sort();
  plan.deleteRemote.sort();
  return plan;
}
