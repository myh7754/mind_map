import { nanoid } from 'nanoid';
import type { MindMapData, MindNode } from '../types';

interface Item {
  depth: number; // 1 = 루트
  text: string;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.+)$/;

/**
 * 마크다운 아웃라인을 항목 목록으로 편다.
 *
 * 제목(#)이 깊이의 뼈대가 되고, 글머리 기호는 직전 제목 아래로 들여쓰기만큼
 * 더 내려간다. 표·본문 문단 등 나머지 줄은 무시한다 —
 * 아웃라인 구조를 가져오는 게 목적이고, 그 외는 어느 노드에 붙일지 애매하다.
 */
function parseItems(markdown: string): Item[] {
  const items: Item[] = [];
  let headingDepth = 0; // 직전 제목의 깊이

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const heading = HEADING.exec(line);
    if (heading) {
      const text = heading[2].trim();
      if (!text) continue;
      headingDepth = heading[1].length;
      items.push({ depth: headingDepth, text });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      const text = bullet[2].trim();
      if (!text) continue;
      // 들여쓰기 2칸 = 한 단계. 탭은 2칸으로 친다.
      const indent = bullet[1].replace(/\t/g, '  ').length;
      items.push({ depth: headingDepth + 1 + Math.floor(indent / 2), text });
      continue;
    }
    // 그 외 줄은 무시
  }

  return items;
}

/**
 * 마크다운 아웃라인 → 마인드맵.
 *
 * 제목이 하나뿐인 최상위가 있으면 그것이 루트가 되고, 최상위 항목이 여럿이면
 * fallbackTitle로 루트를 만들어 그 아래 묶는다.
 */
export function importFromMarkdown(markdown: string, fallbackTitle = '가져온 맵'): MindMapData {
  const items = parseItems(markdown);
  if (items.length === 0) {
    throw new Error('가져올 제목이나 목록이 없습니다.');
  }

  const nodes: Record<string, MindNode> = {};
  const children: Record<string, string[]> = {};

  const addNode = (label: string): string => {
    const id = nanoid(8);
    nodes[id] = { id, type: 'text', label, note: '', collapsed: false };
    children[id] = [];
    return id;
  };

  const minDepth = Math.min(...items.map((i) => i.depth));
  const topLevel = items.filter((i) => i.depth === minDepth);

  let rootId: string;
  // 스택[d] = 깊이 d에서 마지막으로 만든 노드 id
  const stack = new Map<number, string>();

  if (topLevel.length === 1 && items[0].depth === minDepth) {
    rootId = addNode(items[0].text);
    stack.set(minDepth, rootId);
    items.shift();
  } else {
    rootId = addNode(fallbackTitle);
    stack.set(minDepth - 1, rootId);
  }

  for (const item of items) {
    const id = addNode(item.text);

    // 자기보다 얕은 것 중 가장 가까운 조상을 찾는다
    let parentId = rootId;
    for (let d = item.depth - 1; d >= 0; d--) {
      const candidate = stack.get(d);
      if (candidate) {
        parentId = candidate;
        break;
      }
    }
    children[parentId].push(id);

    stack.set(item.depth, id);
    // 더 깊은 자리는 무효화한다. 안 그러면 다시 얕아졌다 깊어질 때
    // 예전 형제 밑으로 잘못 붙는다.
    for (const d of [...stack.keys()]) {
      if (d > item.depth) stack.delete(d);
    }
  }

  return {
    id: nanoid(10),
    title: nodes[rootId].label || fallbackTitle,
    rootId,
    children,
    nodes,
  };
}

/** 텍스트 파일 하나를 고르게 하고 내용을 돌려준다 */
export function pickTextFile(accept: string): Promise<{ name: string; text: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return reject(new Error('파일이 선택되지 않았습니다.'));
      const reader = new FileReader();
      reader.onload = (ev) => resolve({ name: file.name, text: (ev.target?.result as string) ?? '' });
      reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
      reader.readAsText(file);
    };
    input.click();
  });
}
