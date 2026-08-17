import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewMenu } from './ViewMenu';
import { useMindMapStore } from '../../store/useMindMapStore';

const store = () => useMindMapStore.getState();
const collapsedIds = () =>
  Object.values(store().mindMapData.nodes)
    .filter((n) => n.collapsed)
    .map((n) => n.id)
    .sort();

/** 트리: root → a, b ; a → a1 ; a1 → a1x   (자식 있는 건 root, a, a1) */
beforeEach(() => {
  useMindMapStore.temporal.getState().clear();
  store().loadFromPersisted(
    {
      id: 'test',
      title: 't',
      rootId: 'root',
      children: { root: ['a', 'b'], a: ['a1'], b: [], a1: ['a1x'], a1x: [] },
      nodes: {
        root: { id: 'root', type: 'text', label: 'root', note: '', collapsed: false },
        a: { id: 'a', type: 'text', label: 'a', note: '', collapsed: false },
        b: { id: 'b', type: 'text', label: 'b', note: '', collapsed: false },
        a1: { id: 'a1', type: 'text', label: 'a1', note: '', collapsed: false },
        a1x: { id: 'a1x', type: 'text', label: 'a1x', note: '', collapsed: false },
      },
    },
    {}
  );
  store().applyLayout();
});

function openMenu() {
  render(<ViewMenu />);
  fireEvent.click(screen.getByRole('button', { name: /보기/ }));
}

describe('ViewMenu', () => {
  it('처음에는 항목이 접혀 있다', () => {
    render(<ViewMenu />);
    expect(screen.queryByText('모두 펼치기')).not.toBeInTheDocument();
  });

  it('버튼을 누르면 항목이 나온다', () => {
    openMenu();
    expect(screen.getByText('모두 펼치기')).toBeInTheDocument();
    expect(screen.getByText('모두 접기')).toBeInTheDocument();
  });

  /**
   * 사용자가 '모두 펼치기' 버튼이 있다는 걸 모르고 있었다.
   * 메뉴 안에 단축키를 같이 적어야 다음에 키로 쓸 수 있다.
   */
  it('항목 옆에 단축키가 함께 보인다', () => {
    openMenu();
    expect(screen.getByText('Ctrl + E')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + Shift + E')).toBeInTheDocument();
  });

  it('모두 접기를 누르면 자식 있는 노드가 접힌다', () => {
    openMenu();
    fireEvent.click(screen.getByText('모두 접기'));
    expect(collapsedIds()).toEqual(['a', 'a1']);
  });

  it('모두 펼치기를 누르면 접힌 게 없어진다', () => {
    store().setAllCollapsed(true);
    openMenu();
    fireEvent.click(screen.getByText('모두 펼치기'));
    expect(collapsedIds()).toEqual([]);
  });

  it('1단계를 누르면 루트의 자식까지만 남는다', () => {
    openMenu();
    fireEvent.click(screen.getByText('1단계까지'));
    expect(store().mindMapData.nodes.a.collapsed).toBe(true);
  });

  it('2단계를 누르면 a는 펼쳐지고 a1은 접힌다', () => {
    store().setAllCollapsed(true);
    openMenu();
    fireEvent.click(screen.getByText('2단계까지'));
    expect(store().mindMapData.nodes.a.collapsed).toBe(false);
    expect(store().mindMapData.nodes.a1.collapsed).toBe(true);
  });

  it('항목을 고르면 메뉴가 닫힌다', () => {
    openMenu();
    fireEvent.click(screen.getByText('모두 접기'));
    expect(screen.queryByText('모두 펼치기')).not.toBeInTheDocument();
  });
});
