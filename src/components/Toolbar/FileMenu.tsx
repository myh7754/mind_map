import { useState } from 'react';
import { saveAs } from 'file-saver';
import { useMindMapStore } from '../../store/useMindMapStore';
import { exportToMarkdown } from '../../utils/exportMarkdown';
import { downloadJson, loadJsonFile } from '../../utils/exportJson';
import { importFromMarkdown, pickTextFile } from '../../utils/importMarkdown';
import { exportToPng } from '../../utils/exportImage';

/**
 * 파일 입출력 메뉴.
 *
 * 전에는 툴바에 버튼 다섯 개가 나란히 있었다. 하루에 한 번 쓸까 말까 한
 * 기능들이 매분 쓰는 버튼(추가·검색·되돌리기)과 같은 무게로 자리를 차지해
 * 툴바가 두 줄로 넘쳤다. 접어두면 폭이 절반 가까이 준다.
 */
export function FileMenu() {
  const mindMapData = useMindMapStore((s) => s.mindMapData);
  const rfNodes = useMindMapStore((s) => s.rfNodes);
  const loadFromPersisted = useMindMapStore((s) => s.loadFromPersisted);
  const openMap = useMindMapStore((s) => s.openMap);
  const applyLayout = useMindMapStore((s) => s.applyLayout);
  const setSaveStatus = useMindMapStore((s) => s.setSaveStatus);

  const [isOpen, setIsOpen] = useState(false);

  // 실패를 alert로 띄우면 확장 프로그램·자동화가 멈추고 사용자도 맥락을 잃는다.
  // 툴바의 저장 상태 표시에 얹어 화면 안에서 알린다.
  const fail = (e: unknown) => setSaveStatus('error', (e as Error).message);

  // 동기 동작(JSON 저장 등)은 동기로 돌린다 — Promise로 감싸면 클릭과 실행 사이에
  // 이유 없는 한 틱이 생긴다. 비동기인 것만 catch를 붙인다.
  const run = (fn: () => void | Promise<void>) => {
    setIsOpen(false);
    try {
      fn()?.catch(fail);
    } catch (e) {
      fail(e);
    }
  };

  const handleExportMarkdown = () => {
    const md = exportToMarkdown(mindMapData);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${mindMapData.title}.md`);
  };

  const handleLoadJson = async () => {
    const data = await loadJsonFile();
    loadFromPersisted(data, {});
    setTimeout(applyLayout, 50);
  };

  // 가져온 마크다운은 새 맵으로 연다 (지금 보던 과목을 덮어쓰지 않는다)
  const handleImportMarkdown = async () => {
    const { name, text } = await pickTextFile('.md,.markdown,.txt');
    const fallback = name.replace(/\.(md|markdown|txt)$/i, '');
    openMap(importFromMarkdown(text, fallback), {});
  };

  return (
    <div className="relative">
      <button
        className="px-2 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
        onClick={() => setIsOpen((v) => !v)}
        title="열기 · 저장 · 내보내기"
      >
        ⋯ 파일 ▾
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-1 z-40 w-52 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1">
            <Item icon="📂" label="열기" onClick={() => run(handleLoadJson)} />
            <Item icon="💾" label="JSON 저장" onClick={() => run(() => downloadJson(mindMapData))} />

            <div className="my-1 border-t border-slate-800" />

            <Item icon="📥" label="MD 가져오기" onClick={() => run(handleImportMarkdown)} />
            <Item icon="↓" label="MD 내보내기" onClick={() => run(handleExportMarkdown)} />
            <Item icon="🖼" label="PNG로 저장" onClick={() => run(() => exportToPng(rfNodes, mindMapData.title))} />
          </div>
        </>
      )}
    </div>
  );
}

function Item({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
      onClick={onClick}
    >
      <span className="w-4 text-center shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
