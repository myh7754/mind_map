import { useState } from 'react';
import { useMindMapStore } from '../../store/useMindMapStore';
import { keysFor } from '../../utils/shortcuts';

const LEVELS = [1, 2, 3, 4];

/**
 * 펼치기 / 접기 메뉴.
 *
 * 툴바에 '모두 펼치기'·'모두 접기' 버튼을 나란히 두었더니 폭만 먹고
 * 정작 사용자는 존재를 몰랐다. 한 메뉴로 묶고 단축키를 옆에 적어
 * "여기 있다 + 다음엔 키로 해라"를 같이 알린다.
 *
 * 단계별 펼치기가 핵심이다 — 217노드짜리 맵은 전부 펼치면 못 읽고
 * 전부 접으면 아무것도 안 보인다.
 */
export function ViewMenu() {
  const setAllCollapsed = useMindMapStore((s) => s.setAllCollapsed);
  const expandToLevel = useMindMapStore((s) => s.expandToLevel);
  const [isOpen, setIsOpen] = useState(false);

  // 고르면 닫는다 — 연속으로 단계를 바꿔볼 일은 드물고, 열린 채로 두면 맵을 가린다
  const run = (fn: () => void) => {
    setIsOpen(false);
    fn();
  };

  return (
    <div className="relative">
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={() => setIsOpen((v) => !v)}
        title="펼치기 / 접기"
      >
        👁 보기 ▾
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 w-60 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1">
            <MenuItem
              label="모두 펼치기"
              keys={keysFor('모두 펼치기')}
              onClick={() => run(() => setAllCollapsed(false))}
            />
            <MenuItem
              label="모두 접기"
              keys={keysFor('모두 접기')}
              onClick={() => run(() => setAllCollapsed(true))}
            />

            <div className="my-1 border-t border-slate-800" />
            <div className="px-3 py-1 text-[10px] text-slate-600">그 단계까지만 펼치기</div>

            {LEVELS.map((n) => (
              <MenuItem
                key={n}
                label={`${n}단계까지`}
                keys={`Ctrl + ${n}`}
                onClick={() => run(() => expandToLevel(n))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  label,
  keys,
  onClick,
}: {
  label: string;
  keys?: string;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
      onClick={onClick}
    >
      <span>{label}</span>
      {keys && (
        <kbd className="shrink-0 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800 text-[10px] font-mono text-slate-400 whitespace-nowrap">
          {keys}
        </kbd>
      )}
    </button>
  );
}
