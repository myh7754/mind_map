import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { notePreviewBlocks, type PreviewBlock } from '../../utils/notePreview';

const CARD_W = 360;
const CARD_MAX_H = 320;
const GAP = 6;
const MARGIN = 8;
// 아이콘 → 카드로 마우스를 옮기는 사이 틈에서 카드가 닫히지 않게 주는 유예
const CLOSE_DELAY = 120;

interface Props {
  note: string;
  title: string;
  className: string;
  onOpen: () => void;
}

/**
 * 노드의 📝 아이콘. 마우스를 올리면 노트 미리보기 카드를 띄우고,
 * 아이콘이나 카드 위에 있는 동안 유지한다(카드 안에서 긴 노트를 스크롤할 수 있게). 클릭하면 노트 창.
 *
 * 카드는 body로 포털한다: 노드 안에 두면 캔버스 배율을 따라 글자가 작아지고,
 * 이웃 노드에 가려진다.
 * ponytail: 위치는 hover 순간 아이콘 좌표로 고정 — 카드가 뜬 채로 휠 줌하면 아이콘과 어긋난다.
 */
export function NoteIconButton({ note, title, className, onOpen }: Props) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const keepOpen = () => clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setAnchor(null), CLOSE_DELAY);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <>
      <button
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(null);
          onOpen();
        }}
        onMouseEnter={(e) => {
          keepOpen();
          setAnchor(e.currentTarget.getBoundingClientRect());
        }}
        onMouseLeave={scheduleClose}
        aria-label="노트 있음"
      >
        📝
      </button>
      {anchor &&
        createPortal(
          <NotePreviewCard
            note={note}
            title={title}
            anchor={anchor}
            onMouseEnter={keepOpen}
            onMouseLeave={scheduleClose}
          />,
          document.body
        )}
    </>
  );
}

function NotePreviewCard({
  note,
  title,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: {
  note: string;
  title: string;
  anchor: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const blocks = useMemo(() => notePreviewBlocks(note), [note]);

  // 오른쪽에 자리가 없으면 왼쪽에 띄우고, 위아래는 화면 안으로 끌어온다
  const right = anchor.right + GAP;
  const left =
    right + CARD_W + MARGIN <= window.innerWidth ? right : Math.max(MARGIN, anchor.left - GAP - CARD_W);
  const top = Math.max(MARGIN, Math.min(anchor.top - MARGIN, window.innerHeight - CARD_MAX_H - MARGIN));

  return (
    <div
      role="tooltip"
      style={{ position: 'fixed', left, top, width: CARD_W, maxHeight: CARD_MAX_H }}
      className="z-50 flex flex-col rounded-lg border border-slate-600 bg-slate-900 shadow-2xl text-xs text-slate-300"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="px-3 py-2 border-b border-slate-700 text-slate-100 font-semibold truncate">
        📝 {title}
      </div>
      <div className="px-3 py-2 overflow-y-auto space-y-1 leading-relaxed select-text">
        {blocks.map((b, i) => (
          <PreviewLine key={i} block={b} />
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-500">
        클릭하면 노트 창에서 전체 보기
      </div>
    </div>
  );
}

function PreviewLine({ block: b }: { block: PreviewBlock }) {
  const indent = { paddingLeft: b.depth * 14 };
  switch (b.kind) {
    case 'heading':
      return (
        <div style={indent} className={`pt-1 font-semibold text-slate-100 ${b.level === 1 ? 'text-sm' : ''}`}>
          {b.text}
        </div>
      );
    case 'bullet':
    case 'numbered':
    case 'check':
      return (
        <div style={indent} className="flex gap-1.5">
          <span className="shrink-0 text-slate-500">
            {b.kind === 'bullet' ? '•' : b.kind === 'numbered' ? `${b.index}.` : b.checked ? '☑' : '☐'}
          </span>
          <span className="min-w-0 break-words">{b.text}</span>
        </div>
      );
    case 'code':
      return (
        <pre
          style={indent}
          className="font-mono text-[11px] bg-slate-950 border border-slate-800 rounded px-2 py-1 whitespace-pre-wrap break-words"
        >
          {b.text}
        </pre>
      );
    case 'quote':
      return (
        <div style={indent} className="border-l-2 border-slate-600 pl-2 text-slate-400">
          {b.text}
        </div>
      );
    case 'other':
      return (
        <div style={indent} className="text-slate-500 italic break-words">
          {b.text}
        </div>
      );
    default:
      return b.text ? (
        <p style={indent} className="break-words">
          {b.text}
        </p>
      ) : (
        <div className="h-1.5" />
      );
  }
}
