import { describe, it, expect } from 'vitest';
import { planSync, type SyncEntry } from './syncMerge';

const e = (id: string, updatedAt: number, deletedAt?: number): SyncEntry => ({
  id,
  updatedAt,
  ...(deletedAt ? { deletedAt } : {}),
});

const empty = { push: [], pull: [], deleteLocal: [], deleteRemote: [] };

describe('planSync', () => {
  it('양쪽 다 비어 있으면 할 일이 없다', () => {
    expect(planSync([], [])).toEqual(empty);
  });

  it('로컬에만 있는 맵은 올린다', () => {
    expect(planSync([e('a', 100)], [])).toEqual({ ...empty, push: ['a'] });
  });

  it('클라우드에만 있는 맵은 내린다', () => {
    expect(planSync([], [e('a', 100)])).toEqual({ ...empty, pull: ['a'] });
  });

  it('시각이 같으면 아무것도 하지 않는다', () => {
    expect(planSync([e('a', 100)], [e('a', 100)])).toEqual(empty);
  });

  it('로컬이 더 최신이면 올린다', () => {
    expect(planSync([e('a', 200)], [e('a', 100)])).toEqual({ ...empty, push: ['a'] });
  });

  it('클라우드가 더 최신이면 내린다', () => {
    expect(planSync([e('a', 100)], [e('a', 200)])).toEqual({ ...empty, pull: ['a'] });
  });

  describe('삭제', () => {
    it('로컬에서 지운 게 더 최신이면 클라우드에서도 지운다', () => {
      const plan = planSync([e('a', 100, 300)], [e('a', 200)]);
      expect(plan).toEqual({ ...empty, deleteRemote: ['a'] });
    });

    it('클라우드에서 지운 게 더 최신이면 로컬에서도 지운다', () => {
      const plan = planSync([e('a', 200)], [e('a', 100, 300)]);
      expect(plan).toEqual({ ...empty, deleteLocal: ['a'] });
    });

    it('지운 뒤 다른 기기에서 더 나중에 수정했다면 되살아난다', () => {
      // 삭제 300 < 수정 400 → 수정이 이긴다
      const plan = planSync([e('a', 100, 300)], [e('a', 400)]);
      expect(plan).toEqual({ ...empty, pull: ['a'] });
    });

    it('클라우드에서 지워진 맵을 로컬에 새로 만들지 않는다 (부활 방지)', () => {
      // 로컬에 없고 클라우드에는 삭제 표시만 있는 경우
      expect(planSync([], [e('a', 100, 200)])).toEqual(empty);
    });

    it('로컬에서 지웠고 클라우드엔 아예 없으면 할 일이 없다', () => {
      expect(planSync([e('a', 100, 200)], [])).toEqual(empty);
    });

    it('양쪽 다 지웠으면 할 일이 없다', () => {
      expect(planSync([e('a', 100, 200)], [e('a', 100, 200)])).toEqual(empty);
    });
  });

  it('여러 맵을 한 번에 처리한다', () => {
    const local = [e('올릴것', 200), e('그대로', 100), e('지울것', 100, 500)];
    const remote = [e('내릴것', 300), e('그대로', 100), e('지울것', 100)];

    expect(planSync(local, remote)).toEqual({
      push: ['올릴것'],
      pull: ['내릴것'],
      deleteLocal: [],
      deleteRemote: ['지울것'],
    });
  });

  it('첫 로그인 시 로컬 맵이 전부 올라간다 (기존 작업이 사라지지 않는다)', () => {
    const local = [e('자바', 100), e('영어', 200), e('수학', 300)];
    expect(planSync(local, []).push).toEqual(['수학', '영어', '자바']);
  });

  it('새 기기에서 로그인하면 클라우드 맵이 전부 내려온다', () => {
    const remote = [e('자바', 100), e('영어', 200)];
    expect(planSync([], remote).pull).toEqual(['영어', '자바']);
  });

  it('한 맵이 push와 pull에 동시에 들어가지 않는다', () => {
    const plan = planSync([e('a', 200)], [e('a', 100)]);
    const all = [...plan.push, ...plan.pull, ...plan.deleteLocal, ...plan.deleteRemote];
    expect(new Set(all).size).toBe(all.length);
  });
});
