import type { MindMapData } from '../types';
import { noteToPlainText } from './noteText';

// [[노드 이름]] — 대괄호 두 겹 안의 텍스트
const WIKI_LINK = /\[\[([^[\]]+)\]\]/g;

/** 텍스트에서 [[...]] 대상 이름을 뽑는다 (중복 제거, 등장 순서 유지) */
export function extractWikiLinks(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(WIKI_LINK)) {
    const name = match[1].trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

export interface LinkIndex {
  /** nodeId → 이 노드가 참조하는 노드 id들 */
  outgoing: Record<string, string[]>;
  /** nodeId → 이 노드를 참조하는 노드 id들 */
  backlinks: Record<string, string[]>;
  /** nodeId → 대상 노드를 못 찾은 이름들 */
  unresolved: Record<string, string[]>;
}

/**
 * 노트 본문의 [[노드 이름]]을 훑어 링크 색인을 만든다.
 *
 * 마인드맵은 트리지만 링크는 그래프다. 이 색인이 트리 구조 위에 얹히는
 * 두 번째 간선 집합이고, 노트에서 파생되므로 따로 저장하지 않는다.
 *
 * 이름 → 노드는 라벨로 맞춘다(대소문자·앞뒤 공백 무시). 같은 라벨이 여럿이면
 * 먼저 나온 노드로 간다.
 *
 * ponytail: 호출될 때마다 전체 노드를 훑는다. 노트 평문화는 캐시되어 있어
 * 실제 비용은 짧은 문자열 정규식 스캔뿐이다. 노드가 수천 개로 늘어 느려지면
 * 노트 변경 시에만 갱신하는 증분 색인으로 바꾸면 된다.
 */
export function buildLinkIndex(data: MindMapData): LinkIndex {
  const idByLabel = new Map<string, string>();
  for (const node of Object.values(data.nodes)) {
    const key = node.label.trim().toLowerCase();
    if (key && !idByLabel.has(key)) idByLabel.set(key, node.id);
  }

  const outgoing: Record<string, string[]> = {};
  const backlinks: Record<string, string[]> = {};
  const unresolved: Record<string, string[]> = {};

  for (const node of Object.values(data.nodes)) {
    if (!node.note) continue;
    for (const name of extractWikiLinks(noteToPlainText(node.note))) {
      const targetId = idByLabel.get(name.toLowerCase());

      if (!targetId) {
        (unresolved[node.id] ??= []).push(name);
        continue;
      }
      if (targetId === node.id) continue; // 자기 자신 링크는 무시

      (outgoing[node.id] ??= []).push(targetId);
      (backlinks[targetId] ??= []).push(node.id);
    }
  }

  return { outgoing, backlinks, unresolved };
}
