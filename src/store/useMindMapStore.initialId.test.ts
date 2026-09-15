import { describe, it, expect } from 'vitest';
import { useMindMapStore } from './useMindMapStore';

describe('처음 뜨는 맵', () => {
  it('고정 id가 아니다 — 서버 id는 전역 기본키라 사용자끼리 부딪히면 안 된다', () => {
    const { id } = useMindMapStore.getInitialState().mindMapData;
    expect(id).not.toBe('default');
    expect(id.length).toBeGreaterThanOrEqual(10);
  });
});
