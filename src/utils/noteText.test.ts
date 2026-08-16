import { describe, it, expect, beforeEach } from 'vitest';
import { noteToPlainText, hasNoteContent, clearNoteTextCache } from './noteText';

beforeEach(() => clearNoteTextCache());

describe('hasNoteContent', () => {
  it('아예 비어 있으면 false', () => {
    expect(hasNoteContent('')).toBe(false);
  });

  it('열었다 닫기만 한 빈 문서는 false — 이게 핵심', () => {
    // BlockNote가 저장하는 빈 문서. 문자열 길이로 보면 40자가 넘어 true가 돼버린다.
    expect(hasNoteContent(JSON.stringify([{ type: 'paragraph', content: [] }]))).toBe(false);
    expect(hasNoteContent(JSON.stringify([{ type: 'paragraph', content: '' }]))).toBe(false);
  });

  it('공백만 있어도 false', () => {
    const note = JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: '   ', styles: {} }] },
    ]);
    expect(hasNoteContent(note)).toBe(false);
  });

  it('글자가 하나라도 있으면 true', () => {
    const note = JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: 'volatile', styles: {} }] },
    ]);
    expect(hasNoteContent(note)).toBe(true);
  });

  it('코드 블록만 있어도 true', () => {
    const note = JSON.stringify([
      { type: 'codeBlock', props: { language: 'java' }, content: 'int a = 1;' },
    ]);
    expect(hasNoteContent(note)).toBe(true);
  });
});

describe('noteToPlainText', () => {
  it('빈 노트는 빈 문자열', () => {
    expect(noteToPlainText('')).toBe('');
  });

  it('문단 블록의 텍스트를 뽑는다', () => {
    const note = JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: '첫 문단', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: '둘째 문단', styles: {} }] },
    ]);
    expect(noteToPlainText(note)).toBe('첫 문단 둘째 문단');
  });

  it('한 블록 안의 여러 인라인 조각을 모두 뽑는다', () => {
    const note = JSON.stringify([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '굵은', styles: { bold: true } },
          { type: 'text', text: '글씨', styles: {} },
        ],
      },
    ]);
    expect(noteToPlainText(note)).toBe('굵은 글씨');
  });

  it('중첩된 children까지 훑는다', () => {
    const note = JSON.stringify([
      {
        type: 'bulletListItem',
        content: [{ type: 'text', text: '부모 항목', styles: {} }],
        children: [
          {
            type: 'bulletListItem',
            content: [{ type: 'text', text: '자식 항목', styles: {} }],
          },
        ],
      },
    ]);
    expect(noteToPlainText(note)).toContain('부모 항목');
    expect(noteToPlainText(note)).toContain('자식 항목');
  });

  it('type 같은 다른 문자열 필드는 섞이지 않는다', () => {
    const note = JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: '본문', styles: {} }] },
    ]);
    expect(noteToPlainText(note)).toBe('본문');
  });

  it('JSON이 아니면 원본 문자열을 그대로 반환한다', () => {
    expect(noteToPlainText('그냥 평문 메모')).toBe('그냥 평문 메모');
  });

  it('같은 입력을 반복해도 같은 결과 (캐시가 결과를 바꾸지 않는다)', () => {
    const note = JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: '반복', styles: {} }] },
    ]);
    expect(noteToPlainText(note)).toBe('반복');
    expect(noteToPlainText(note)).toBe('반복');
    expect(noteToPlainText(note)).toBe('반복');
  });

  it('캐시 한도를 넘겨도 결과가 정확하다 (오래된 항목 축출 경로)', () => {
    // CACHE_LIMIT(500)보다 많은 서로 다른 노트를 넣어 축출을 유발한다
    for (let i = 0; i < 600; i++) {
      const note = JSON.stringify([
        { type: 'paragraph', content: [{ type: 'text', text: `노트${i}`, styles: {} }] },
      ]);
      expect(noteToPlainText(note)).toBe(`노트${i}`);
    }
    // 축출됐을 첫 항목도 다시 물으면 정확히 계산된다
    const first = JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: '노트0', styles: {} }] },
    ]);
    expect(noteToPlainText(first)).toBe('노트0');
  });
});
