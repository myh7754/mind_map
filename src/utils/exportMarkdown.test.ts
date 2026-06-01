import { describe, it, expect } from 'vitest';
import { exportToMarkdown } from './exportMarkdown';
import type { MindMapData } from '../types';

const sampleData: MindMapData = {
  id: 'test',
  title: '테스트',
  rootId: 'root',
  children: {
    root: ['child1', 'child2'],
    child1: ['grandchild'],
    child2: [],
    grandchild: [],
  },
  nodes: {
    root: { id: 'root', type: 'text', label: '루트', note: '', collapsed: false },
    child1: { id: 'child1', type: 'text', label: '키워드 A', note: '', collapsed: false },
    child2: { id: 'child2', type: 'text', label: '키워드 B', note: '', collapsed: false },
    grandchild: { id: 'grandchild', type: 'text', label: '세부 1', note: '', collapsed: false },
  },
};

describe('exportToMarkdown', () => {
  it('should render root as H1', () => {
    const md = exportToMarkdown(sampleData);
    expect(md).toContain('# 루트');
  });

  it('should render children as H2', () => {
    const md = exportToMarkdown(sampleData);
    expect(md).toContain('## 키워드 A');
    expect(md).toContain('## 키워드 B');
  });

  it('should render grandchildren as H3', () => {
    const md = exportToMarkdown(sampleData);
    expect(md).toContain('### 세부 1');
  });

  it('should render table node as markdown table', () => {
    const dataWithTable: MindMapData = {
      ...sampleData,
      children: { root: ['table1'], table1: [] },
      nodes: {
        root: sampleData.nodes.root,
        table1: {
          id: 'table1',
          type: 'table',
          label: '표',
          note: '',
          collapsed: false,
          tableData: { headers: ['A', 'B'], rows: [['1', '2']] },
        },
      },
    };
    const md = exportToMarkdown(dataWithTable);
    expect(md).toContain('| A | B |');
    expect(md).toContain('| 1 | 2 |');
  });
});
