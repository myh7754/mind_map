import { useMindMapStore } from '../../store/useMindMapStore';
import { SHORTCUT_GROUPS } from '../../utils/shortcuts';

/**
 * 단축키 도움말 모달.
 *
 * 툴바 한 줄에 밀어넣던 안내 문구(`min-[1800px]`에서만 보이던 것)를 대체한다.
 * 그 방식은 화면이 조금만 좁아도 통째로 사라져서, 사실상 아무도 못 보는
 * 안내였다. Esc 처리는 useGlobalShortcuts가 맡는다 (겹친 창의 우선순위를
 * 한곳에서 결정해야 하기 때문).
 */
export function ShortcutsHelp() {
  const isOpen = useMindMapStore((s) => s.isShortcutsOpen);
  const setOpen = useMindMapStore((s) => s.setShortcutsOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        data-testid="shortcuts-backdrop"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div
        role="dialog"
        aria-label="단축키"
        className="relative w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-100">⌨ 단축키</h2>
          <button
            className="text-slate-400 hover:text-slate-200 text-lg leading-none px-1"
            onClick={() => setOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 px-5 py-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">
                {group.title}
              </h3>
              {/* 키를 고정폭 열에 두어 설명의 왼쪽 끝을 맞춘다.
                  설명을 오른쪽 정렬하면 줄마다 시작점이 달라져 훑어읽기가 어렵다. */}
              <dl className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.desc} className="flex items-baseline gap-3">
                    <dt className="shrink-0 w-[8.5rem]">
                      <kbd className="inline-block px-1.5 py-0.5 rounded border border-slate-600 bg-slate-800 text-[11px] font-mono text-slate-200 whitespace-nowrap">
                        {item.keys}
                      </kbd>
                    </dt>
                    <dd className="text-xs text-slate-300 leading-relaxed">{item.desc}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <div className="px-5 py-2.5 border-t border-slate-800 text-[10px] text-slate-500">
          Esc 또는 바깥을 눌러 닫기
        </div>
      </div>
    </div>
  );
}
