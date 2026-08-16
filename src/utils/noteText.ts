/**
 * BlockNote 문서 JSON에서 순수 텍스트만 뽑는다. 노드 검색이 노트 본문까지
 * 훑을 수 있게 하는 용도라, 서식은 버리고 블록 사이만 공백으로 잇는다.
 *
 * BlockNote 블록은 { type, content, children } 형태이고 content는
 * 인라인 노드 배열(각각 text를 가짐)이거나 표처럼 중첩 구조일 수 있어서
 * text 필드를 재귀로 훑는 방식이 가장 안전하다.
 */
function collect(value: unknown, out: string[]): void {
  if (value == null) return;
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collect(v, out);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') out.push(obj.text);
    if (obj.content != null) collect(obj.content, out);
    if (obj.children != null) collect(obj.children, out);
    if (obj.rows != null) collect(obj.rows, out);
    if (obj.cells != null) collect(obj.cells, out);
  }
}

/**
 * 노트 JSON → 평문 캐시.
 * 검색은 키 입력마다 모든 노드의 노트를 훑기 때문에 캐시가 없으면
 * 한 글자마다 전체 노트를 다시 JSON.parse 하게 된다.
 * 노트 문자열은 불변값이라 문자열 자체를 키로 써도 안전하다.
 */
const cache = new Map<string, string>();
const CACHE_LIMIT = 500;

function computePlainText(noteJson: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(noteJson);
  } catch {
    return noteJson; // JSON이 아니면 평문으로 저장된 것으로 본다
  }
  const out: string[] = [];
  collect(parsed, out);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export function noteToPlainText(noteJson: string): string {
  if (!noteJson) return '';

  const hit = cache.get(noteJson);
  if (hit !== undefined) return hit;

  const plain = computePlainText(noteJson);
  // 편집 중에는 노트마다 새 문자열이 계속 생기므로 무한정 쌓이지 않게 잘라낸다.
  // (가장 오래된 것부터 버리는 단순 FIFO — Map은 삽입 순서를 보존한다)
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(noteJson, plain);
  return plain;
}

/**
 * 이 노드에 실제로 적힌 내용이 있는가 (노드에 노트 표시를 띄울지 판단).
 *
 * `note !== ''` 로는 안 된다. 노트를 열었다 닫기만 해도 BlockNote가
 * `[{"type":"paragraph","content":[]}]` 같은 빈 문서를 저장하기 때문에,
 * 문자열 길이로 보면 "한 번 열어본 모든 노드"에 표시가 붙는다.
 * 평문으로 바꿔서 글자가 남는지 본다(캐시가 있어 매 렌더마다 파싱하지 않는다).
 */
export function hasNoteContent(noteJson: string): boolean {
  return noteToPlainText(noteJson).length > 0;
}

/** 테스트용: 캐시 비우기 */
export function clearNoteTextCache(): void {
  cache.clear();
}
