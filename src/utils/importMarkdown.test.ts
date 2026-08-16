import { describe, it, expect } from 'vitest';
import { importFromMarkdown } from './importMarkdown';
import { exportToMarkdown } from './exportMarkdown';
import type { MindMapData } from '../types';

/** 부모 라벨 → 자식 라벨 배열 (id는 매번 달라지므로 라벨로 검증한다) */
function tree(data: MindMapData): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [parentId, kids] of Object.entries(data.children)) {
    out[data.nodes[parentId].label] = kids.map((id) => data.nodes[id].label);
  }
  return out;
}

const rootLabel = (d: MindMapData) => d.nodes[d.rootId].label;

describe('importFromMarkdown', () => {
  it('제목 계층을 트리로 만든다', () => {
    const data = importFromMarkdown(['# 자바', '## 컬렉션', '## 제네릭'].join('\n'));

    expect(rootLabel(data)).toBe('자바');
    expect(tree(data)['자바']).toEqual(['컬렉션', '제네릭']);
  });

  it('제목 깊이가 3단계 이상이어도 이어진다', () => {
    const data = importFromMarkdown(['# A', '## B', '### C', '#### D'].join('\n'));

    expect(tree(data)['A']).toEqual(['B']);
    expect(tree(data)['B']).toEqual(['C']);
    expect(tree(data)['C']).toEqual(['D']);
  });

  it('얕아졌다 다시 깊어져도 올바른 부모에 붙는다', () => {
    const data = importFromMarkdown(['# A', '## B', '### B1', '## C', '### C1'].join('\n'));

    expect(tree(data)['A']).toEqual(['B', 'C']);
    expect(tree(data)['B']).toEqual(['B1']);
    expect(tree(data)['C']).toEqual(['C1']); // B1 밑으로 새면 안 된다
  });

  it('글머리 기호는 직전 제목 아래로 들어간다', () => {
    const data = importFromMarkdown(['# 자바', '## 컬렉션', '- List', '- Map'].join('\n'));

    expect(tree(data)['컬렉션']).toEqual(['List', 'Map']);
  });

  it('글머리 기호 들여쓰기가 중첩이 된다', () => {
    const data = importFromMarkdown(
      ['# 자바', '- 컬렉션', '  - List', '    - ArrayList'].join('\n')
    );

    expect(tree(data)['자바']).toEqual(['컬렉션']);
    expect(tree(data)['컬렉션']).toEqual(['List']);
    expect(tree(data)['List']).toEqual(['ArrayList']);
  });

  it('*, + 도 글머리 기호로 인식한다', () => {
    const data = importFromMarkdown(['# A', '* B', '+ C'].join('\n'));
    expect(tree(data)['A']).toEqual(['B', 'C']);
  });

  it('최상위가 여럿이면 fallback 제목으로 루트를 만든다', () => {
    const data = importFromMarkdown(['# A', '# B'].join('\n'), '내 맵');

    expect(rootLabel(data)).toBe('내 맵');
    expect(tree(data)['내 맵']).toEqual(['A', 'B']);
  });

  it('제목 없이 글머리 기호만 있어도 된다', () => {
    const data = importFromMarkdown(['- A', '- B'].join('\n'), '목록');

    expect(rootLabel(data)).toBe('목록');
    expect(tree(data)['목록']).toEqual(['A', 'B']);
  });

  it('빈 줄과 일반 문단은 무시한다', () => {
    const data = importFromMarkdown(
      ['# A', '', '이건 그냥 설명 문단이다.', '', '## B'].join('\n')
    );

    expect(tree(data)['A']).toEqual(['B']);
    expect(Object.keys(data.nodes)).toHaveLength(2);
  });

  it('가져올 게 없으면 에러', () => {
    expect(() => importFromMarkdown('그냥 문단만 있음')).toThrow();
    expect(() => importFromMarkdown('')).toThrow();
  });

  it('맵 id는 새로 발급된다 (기존 맵을 덮어쓰지 않는다)', () => {
    const a = importFromMarkdown('# A');
    const b = importFromMarkdown('# A');
    expect(a.id).not.toBe(b.id);
  });

  it('내보낸 마크다운을 다시 가져오면 구조가 유지된다', () => {
    const original: MindMapData = {
      id: 'x',
      title: '자바',
      rootId: 'r',
      children: { r: ['c1', 'c2'], c1: ['g1'], c2: [], g1: [] },
      nodes: {
        r: { id: 'r', type: 'text', label: '자바', note: '', collapsed: false },
        c1: { id: 'c1', type: 'text', label: '컬렉션', note: '', collapsed: false },
        c2: { id: 'c2', type: 'text', label: '제네릭', note: '', collapsed: false },
        g1: { id: 'g1', type: 'text', label: 'List', note: '', collapsed: false },
      },
    };

    const reimported = importFromMarkdown(exportToMarkdown(original));

    expect(rootLabel(reimported)).toBe('자바');
    expect(tree(reimported)['자바']).toEqual(['컬렉션', '제네릭']);
    expect(tree(reimported)['컬렉션']).toEqual(['List']);
  });
});
