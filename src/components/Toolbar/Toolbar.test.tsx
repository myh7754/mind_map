import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// 맵 목록은 IndexedDB를 읽는다 — jsdom에는 없으므로 경계만 가짜로 둔다
vi.mock('../../db/mindmapDB', () => ({
  listMaps: vi.fn().mockResolvedValue([]),
  loadMindMap: vi.fn(),
  deleteMap: vi.fn(),
  saveMindMap: vi.fn().mockResolvedValue(Date.now()),
}));

import { Toolbar } from './Toolbar';
import { useMindMapStore } from '../../store/useMindMapStore';

const store = () => useMindMapStore.getState();

beforeEach(() => {
  store().setShortcutsOpen(false);
});

describe('Toolbar', () => {
  /**
   * 툴바가 15개 버튼으로 두 줄이 되어 "지저분하다"는 지적을 받았다.
   * 하루에 한 번 쓸까 말까 한 파일 입출력은 메뉴 안으로 들어가야 한다 —
   * 다시 밖으로 꺼내면 이 테스트가 깨진다.
   */
  it('파일 입출력 버튼은 툴바에 직접 노출되지 않는다', () => {
    render(<Toolbar />);
    // 아이콘이 앞에 붙으므로(💾 JSON 저장) 부분 일치로 본다 — 정확 일치는 그냥 통과해버린다
    for (const label of [/JSON 저장/, /MD 가져오기/, /MD 내보내기/, /PNG/]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('모두 펼치기/접기도 보기 메뉴 안으로 들어갔다', () => {
    render(<Toolbar />);
    expect(screen.queryByText(/모두 펼치기/)).not.toBeInTheDocument();
    expect(screen.queryByText(/모두 접기/)).not.toBeInTheDocument();
  });

  it('매번 쓰는 것들은 그대로 밖에 있다', () => {
    render(<Toolbar />);
    expect(screen.getByRole('button', { name: /텍스트/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /검색/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /보기/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /파일/ })).toBeInTheDocument();
  });

  it('단축키 버튼을 누르면 도움말이 열린다', () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole('button', { name: '단축키' }));
    expect(store().isShortcutsOpen).toBe(true);
  });
});
