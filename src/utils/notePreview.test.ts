import { describe, it, expect } from 'vitest';
import { notePreviewBlocks } from './notePreview';

const doc = (blocks: unknown[]) => JSON.stringify(blocks);
const text = (t: string) => [{ type: 'text', text: t, styles: {} }];

describe('notePreviewBlocks', () => {
  it('빈 노트와 빈 문서는 아무것도 보여주지 않는다', () => {
    expect(notePreviewBlocks('')).toEqual([]);
    expect(notePreviewBlocks(doc([{ type: 'paragraph', content: [] }]))).toEqual([]);
  });

  it('JSON이 아니면 평문 한 단락으로 본다', () => {
    expect(notePreviewBlocks('그냥 글')).toEqual([{ kind: 'paragraph', text: '그냥 글', depth: 0 }]);
  });

  it('제목·목록·단락을 종류별로 펴고, 중첩은 depth로 남긴다', () => {
    const blocks = notePreviewBlocks(
      doc([
        { type: 'heading', props: { level: 2 }, content: text('제네릭') },
        {
          type: 'bulletListItem',
          content: text('타입 체크'),
          children: [{ type: 'bulletListItem', content: text('컴파일 시점') }],
        },
        { type: 'paragraph', content: text('본문') },
      ])
    );
    expect(blocks).toEqual([
      { kind: 'heading', text: '제네릭', depth: 0, level: 2 },
      { kind: 'bullet', text: '타입 체크', depth: 0 },
      { kind: 'bullet', text: '컴파일 시점', depth: 1 },
      { kind: 'paragraph', text: '본문', depth: 0 },
    ]);
  });

  it('번호 목록은 이어지는 동안 번호를 매기고, 끊기면 1부터 다시 센다', () => {
    const blocks = notePreviewBlocks(
      doc([
        { type: 'numberedListItem', content: text('a') },
        { type: 'numberedListItem', content: text('b') },
        { type: 'paragraph', content: text('끊김') },
        { type: 'numberedListItem', content: text('c') },
      ])
    );
    expect(blocks.map((b) => b.index)).toEqual([1, 2, undefined, 1]);
  });

  it('코드 블록은 줄바꿈을 보존하고, 링크 안의 글자도 읽는다', () => {
    const blocks = notePreviewBlocks(
      doc([
        { type: 'codeBlock', content: text('int a = 1;\nint b = 2;') },
        { type: 'paragraph', content: [{ type: 'link', href: 'x', content: text('링크') }, ...text(' 뒤')] },
      ])
    );
    expect(blocks[0]).toEqual({ kind: 'code', text: 'int a = 1;\nint b = 2;', depth: 0 });
    expect(blocks[1].text).toBe('링크 뒤');
  });

  it('체크 목록은 체크 여부를, 이미지 같은 블록은 이름을 남긴다', () => {
    const blocks = notePreviewBlocks(
      doc([
        { type: 'checkListItem', props: { checked: true }, content: text('완료') },
        { type: 'image', props: { name: 'diagram.png' } },
      ])
    );
    expect(blocks[0]).toEqual({ kind: 'check', text: '완료', depth: 0, checked: true });
    expect(blocks[1]).toEqual({ kind: 'other', text: 'diagram.png', depth: 0 });
  });

  it('BlockNote가 끝에 붙이는 빈 단락은 잘라낸다', () => {
    const blocks = notePreviewBlocks(
      doc([
        { type: 'paragraph', content: text('내용') },
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [] },
      ])
    );
    expect(blocks).toHaveLength(1);
  });
});
