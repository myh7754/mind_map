import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

const PADDING_RATIO = 0.08;
// 브라우저 캔버스 한계와 파일 크기를 감안한 상한
const MAX_SIDE = 4000;
const CANVAS_BG = '#020617'; // bg-slate-950

/**
 * 보이는 노드 전체가 들어가도록 마인드맵을 PNG로 내보낸다.
 *
 * 화면에 보이는 영역이 아니라 노드들의 실제 경계를 기준으로 잡아,
 * 스크롤 밖에 있던 노드도 함께 담긴다.
 *
 * ponytail: SVG는 안 만든다. 노드가 HTML(표·입력 포함)이라 SVG로 옮기면
 * foreignObject에 폰트까지 끼워 넣어야 하고 결과가 뷰어마다 달라진다.
 * 필요해지면 그때.
 */
export async function exportToPng(nodes: Node[], title: string): Promise<void> {
  const visible = nodes.filter((n) => !n.hidden);
  if (visible.length === 0) throw new Error('내보낼 노드가 없습니다.');

  // xyflow가 "sub flow에서는 useReactFlow의 getNodesBounds를 쓰라"고 콘솔 경고를 남기는데,
  // 이 앱은 sub flow(중첩 flow)를 쓰지 않으므로 독립 함수 결과가 정확하다.
  // 훅 버전을 쓰려면 export를 ReactFlowProvider 안으로 옮겨야 해서 그냥 둔다.
  const bounds = getNodesBounds(visible);
  const scale = Math.min(
    1,
    MAX_SIDE / Math.max(bounds.width, bounds.height, 1)
  );
  const width = Math.ceil(bounds.width * scale) || 1;
  const height = Math.ceil(bounds.height * scale) || 1;

  const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, PADDING_RATIO);

  const el = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!el) throw new Error('캔버스를 찾지 못했습니다.');

  const dataUrl = await toPng(el, {
    backgroundColor: CANVAS_BG,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });

  saveAs(dataUrl, `${title}.png`);
}
