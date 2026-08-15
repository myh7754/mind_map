import { useEffect, useMemo, useRef, useState } from 'react';
import { useMindMapStore } from '../../store/useMindMapStore';
import { noteToPlainText } from '../../utils/noteText';

const MAX_RESULTS = 50;
const SNIPPET_PAD = 30;

interface Hit {
  id: string;
  label: string;
  snippet: string | null; // 노트 본문에서 매치된 경우의 앞뒤 문맥
}

/** 매치 위치 주변만 잘라 보여준다 */
function makeSnippet(text: string, at: number, len: number): string {
  const start = Math.max(0, at - SNIPPET_PAD);
  const end = Math.min(text.length, at + len + SNIPPET_PAD);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export function SearchPanel() {
  const isSearchOpen = useMindMapStore((s) => s.isSearchOpen);
  const setSearchOpen = useMindMapStore((s) => s.setSearchOpen);
  const mindMapData = useMindMapStore((s) => s.mindMapData);

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 열릴 때마다 입력에 포커스 + 이전 검색어 전체 선택 (바로 덮어쓰기 가능)
  useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isSearchOpen]);

  // 노트 본문은 BlockNote JSON이라 평문으로 펴서 검색한다.
  // 노드 수 x 노트 길이라 매 타이핑마다 돌지만, 검색창이 열려 있을 때만 계산된다.
  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || !isSearchOpen) return [];
    const out: Hit[] = [];
    for (const node of Object.values(mindMapData.nodes)) {
      if (out.length >= MAX_RESULTS) break;
      if (node.label.toLowerCase().includes(q)) {
        out.push({ id: node.id, label: node.label, snippet: null });
        continue;
      }
      const plain = noteToPlainText(node.note);
      const at = plain.toLowerCase().indexOf(q);
      if (at >= 0) {
        out.push({ id: node.id, label: node.label, snippet: makeSnippet(plain, at, q.length) });
      }
    }
    return out;
  }, [query, mindMapData, isSearchOpen]);

  // 검색어가 바뀌면 커서를 첫 결과로. effect가 아니라 이벤트에서 같이 처리해야
  // 렌더가 연쇄로 도는 걸 피할 수 있다.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setCursor(0);
  };

  const jumpTo = (id: string) => {
    const store = useMindMapStore.getState();
    store.revealNode(id); // 접힌 조상이 있으면 펼쳐서 화면에 드러낸다
    store.setSelectedNodeId(id);
    store.focusNode(id, true); // 명시적 이동이므로 화면 중앙으로
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (cursor + 1) % hits.length;
      setCursor(next);
      jumpTo(hits[next].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (cursor - 1 + hits.length) % hits.length;
      setCursor(next);
      jumpTo(hits[next].id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      jumpTo(hits[cursor].id);
    }
  };

  if (!isSearchOpen) return null;

  return (
    <div className="absolute top-3 right-3 z-20 w-80 rounded-lg border border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-slate-500 text-sm">🔍</span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
          placeholder="노드 · 노트 검색"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <span className="text-xs text-slate-500 tabular-nums">
          {query.trim() ? `${hits.length ? cursor + 1 : 0}/${hits.length}` : ''}
        </span>
        <button
          className="text-slate-400 hover:text-slate-200 text-sm leading-none"
          onClick={() => setSearchOpen(false)}
          title="닫기 (Esc)"
        >
          ✕
        </button>
      </div>

      {query.trim() !== '' && (
        <div className="max-h-72 overflow-y-auto">
          {hits.length === 0 ? (
            <div className="px-3 py-4 text-xs text-slate-500 text-center">결과 없음</div>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.id}
                className={`w-full text-left px-3 py-2 border-b border-slate-800 last:border-b-0 hover:bg-slate-800 ${
                  i === cursor ? 'bg-slate-800' : ''
                }`}
                onClick={() => {
                  setCursor(i);
                  jumpTo(hit.id);
                }}
              >
                <div className="text-sm text-slate-200 truncate">{hit.label}</div>
                {hit.snippet && (
                  <div className="text-xs text-slate-500 truncate mt-0.5">📝 {hit.snippet}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}

      <div className="px-3 py-1.5 text-[10px] text-slate-600 border-t border-slate-800">
        ↑↓ 이동 · Enter 선택 · Esc 닫기
      </div>
    </div>
  );
}
