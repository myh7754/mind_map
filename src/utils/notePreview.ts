/**
 * 노트(BlockNote 문서 JSON)를 hover 미리보기용 단순 블록 목록으로 편다.
 *
 * 미리보기에 BlockNote 에디터를 쓰지 않는 이유: 에디터 청크가 1MB를 넘어서,
 * 아이콘에 마우스만 올려도 그걸 받아오게 된다. 훑어보기에는 블록 단위 서식이면 충분하다.
 * ponytail: 인라인 서식(굵게·색·링크 모양)은 버린다. 필요해지면 inlineText가 조각 배열을 돌려주게 바꿀 것.
 */

export type PreviewKind =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'check'
  | 'code'
  | 'quote'
  | 'other';

export interface PreviewBlock {
  kind: PreviewKind;
  text: string;
  /** 목록 중첩 깊이 (들여쓰기) */
  depth: number;
  level?: number;
  index?: number;
  checked?: boolean;
}

interface RawBlock {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: RawBlock[];
}

const KIND: Record<string, PreviewKind> = {
  heading: 'heading',
  paragraph: 'paragraph',
  bulletListItem: 'bullet',
  numberedListItem: 'numbered',
  checkListItem: 'check',
  codeBlock: 'code',
  quote: 'quote',
};

/** 인라인 노드(텍스트·링크)와 표 셀을 글자로 잇는다 */
function inlineText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(inlineText).join('');
  if (content && typeof content === 'object') {
    const o = content as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (Array.isArray(o.rows)) {
      return (o.rows as { cells?: unknown[] }[])
        .map((row) => (row.cells ?? []).map(inlineText).join(' | '))
        .join('\n');
    }
    if (o.content != null) return inlineText(o.content);
  }
  return '';
}

function flatten(blocks: RawBlock[], depth: number, out: PreviewBlock[]): void {
  let counter = 0;
  for (const b of blocks) {
    const kind = KIND[b.type ?? ''] ?? 'other';
    counter = kind === 'numbered' ? counter + 1 : 0;

    let text = inlineText(b.content);
    // 이미지·파일처럼 글자가 없는 블록은 이름이라도 보여준다
    if (kind === 'other' && !text) text = String(b.props?.name || b.props?.caption || `[${b.type}]`);

    out.push({
      kind,
      text,
      depth,
      ...(kind === 'heading' ? { level: Number(b.props?.level ?? 1) } : {}),
      ...(kind === 'numbered' ? { index: counter } : {}),
      ...(kind === 'check' ? { checked: b.props?.checked === true } : {}),
    });
    if (b.children?.length) flatten(b.children, depth + 1, out);
  }
}

export function notePreviewBlocks(noteJson: string): PreviewBlock[] {
  if (!noteJson) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(noteJson);
  } catch {
    return [{ kind: 'paragraph', text: noteJson, depth: 0 }]; // noteText.ts와 같은 규칙: 평문 노트
  }
  if (!Array.isArray(parsed)) return [];

  const out: PreviewBlock[] = [];
  flatten(parsed as RawBlock[], 0, out);
  // BlockNote는 문서 끝에 빈 단락을 남긴다 — 카드 아래 빈 줄이 되지 않게 자른다
  while (out.length > 0 && out[out.length - 1].kind === 'paragraph' && !out[out.length - 1].text.trim()) {
    out.pop();
  }
  return out;
}
