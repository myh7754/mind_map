import { describe, it, expect, beforeEach } from 'vitest';
import { extractWikiLinks, buildLinkIndex } from './wikiLinks';
import { clearNoteTextCache } from './noteText';
import type { MindMapData, MindNode } from '../types';

beforeEach(() => clearNoteTextCache());

/** BlockNote 문서 한 문단짜리 노트를 만든다 */
const note = (text: string) =>
  JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text, styles: {} }] }]);

const node = (id: string, label: string, noteText = ''): MindNode => ({
  id,
  type: 'text',
  label,
  note: noteText ? note(noteText) : '',
  collapsed: false,
});

function mapOf(...nodes: MindNode[]): MindMapData {
  return {
    id: 'test',
    title: 't',
    rootId: nodes[0].id,
    children: Object.fromEntries(nodes.map((n) => [n.id, []])),
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
  };
}

describe('extractWikiLinks', () => {
  it('[[이름]]을 뽑는다', () => {
    expect(extractWikiLinks('앞 [[제네릭]] 뒤')).toEqual(['제네릭']);
  });

  it('여러 개를 순서대로 뽑는다', () => {
    expect(extractWikiLinks('[[A]] 그리고 [[B]]')).toEqual(['A', 'B']);
  });

  it('중복은 한 번만', () => {
    expect(extractWikiLinks('[[A]] [[A]]')).toEqual(['A']);
  });

  it('앞뒤 공백을 정리한다', () => {
    expect(extractWikiLinks('[[  제네릭  ]]')).toEqual(['제네릭']);
  });

  it('링크가 없으면 빈 배열', () => {
    expect(extractWikiLinks('그냥 텍스트')).toEqual([]);
  });

  it('빈 대괄호나 한 겹은 무시한다', () => {
    expect(extractWikiLinks('[[]] [단일] [[ ]]')).toEqual([]);
  });
});

describe('buildLinkIndex', () => {
  it('노트의 링크로 outgoing과 backlinks를 만든다', () => {
    const data = mapOf(
      node('a', '자바', '[[제네릭]] 공부하기'),
      node('b', '제네릭')
    );
    const index = buildLinkIndex(data);

    expect(index.outgoing.a).toEqual(['b']);
    expect(index.backlinks.b).toEqual(['a']);
  });

  it('여러 노드가 한 노드를 가리키면 역링크가 모인다', () => {
    const data = mapOf(
      node('t', '컬렉션'),
      node('a', '리스트', '[[컬렉션]] 참고'),
      node('b', '맵', '[[컬렉션]] 참고')
    );
    expect(buildLinkIndex(data).backlinks.t).toEqual(['a', 'b']);
  });

  it('대소문자와 공백을 무시하고 라벨을 맞춘다', () => {
    const data = mapOf(node('a', 'Java', '[[  java  ]]'), node('b', 'x'));
    // a의 링크가 자기 자신(Java)을 가리키므로 무시되어야 한다
    expect(buildLinkIndex(data).outgoing.a).toBeUndefined();
  });

  it('대상 노드가 없으면 unresolved로 남는다', () => {
    const data = mapOf(node('a', '자바', '[[없는노드]]'));
    const index = buildLinkIndex(data);

    expect(index.unresolved.a).toEqual(['없는노드']);
    expect(index.outgoing.a).toBeUndefined();
  });

  it('자기 자신 링크는 무시한다', () => {
    const data = mapOf(node('a', '자바', '[[자바]]'));
    const index = buildLinkIndex(data);

    expect(index.outgoing.a).toBeUndefined();
    expect(index.backlinks.a).toBeUndefined();
  });

  it('노트가 비어 있으면 아무 링크도 없다', () => {
    const index = buildLinkIndex(mapOf(node('a', '자바'), node('b', '제네릭')));
    expect(index.outgoing).toEqual({});
    expect(index.backlinks).toEqual({});
  });

  it('링크는 양방향으로 이어진다 (A→B면 B의 역링크에 A)', () => {
    const data = mapOf(
      node('a', '스프링', '[[의존성 주입]]을 쓴다'),
      node('b', '의존성 주입', '[[스프링]]에서 핵심')
    );
    const index = buildLinkIndex(data);

    expect(index.outgoing.a).toEqual(['b']);
    expect(index.outgoing.b).toEqual(['a']);
    expect(index.backlinks.a).toEqual(['b']);
    expect(index.backlinks.b).toEqual(['a']);
  });
});
