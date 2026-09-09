import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsHelp } from './ShortcutsHelp';
import { useMindMapStore } from '../../store/useMindMapStore';

const store = () => useMindMapStore.getState();

beforeEach(() => {
  store().setShortcutsOpen(false);
});

describe('ShortcutsHelp', () => {
  it('닫혀 있으면 아무것도 그리지 않는다', () => {
    const { container } = render(<ShortcutsHelp />);
    expect(container).toBeEmptyDOMElement();
  });

  it('열리면 단축키 목록이 보인다', () => {
    store().setShortcutsOpen(true);
    render(<ShortcutsHelp />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /**
   * 이 앱에서 실제로 겪은 문제: 기능(모두 펼치기)이 있는데도 사용자가 존재를
   * 모르고 있었다. 도움말이 실제 단축키를 담고 있는지 못박아 둔다 —
   * 여기가 비면 기능이 다시 "없는 것"이 된다.
   */
  it('보기 단축키가 실제로 적혀 있다', () => {
    store().setShortcutsOpen(true);
    render(<ShortcutsHelp />);
    expect(screen.getByText('Ctrl + E')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + Shift + E')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + 1 ~ 4')).toBeInTheDocument();
    expect(screen.getByText('Space')).toBeInTheDocument();
  });

  it('노드 만들기 단축키도 적혀 있다', () => {
    store().setShortcutsOpen(true);
    render(<ShortcutsHelp />);
    expect(screen.getByText('Tab')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('F2')).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 닫힌다', () => {
    store().setShortcutsOpen(true);
    render(<ShortcutsHelp />);

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(store().isShortcutsOpen).toBe(false);
  });

  it('바깥을 누르면 닫힌다', () => {
    store().setShortcutsOpen(true);
    render(<ShortcutsHelp />);

    fireEvent.click(screen.getByTestId('shortcuts-backdrop'));

    expect(store().isShortcutsOpen).toBe(false);
  });
});
