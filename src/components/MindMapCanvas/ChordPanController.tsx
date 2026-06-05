import { useEffect } from 'react';
import { useStoreApi } from '@xyflow/react';

/**
 * 좌클릭 + 우클릭을 동시에 누른 채 드래그하면 화면을 "잡아 당기듯" 이동(pan)시킨다.
 *
 * ReactFlow의 panOnDrag는 버튼 하나만 인식하므로 두 버튼 동시(chord)는 직접 처리한다.
 * - event.buttons 비트마스크: 좌(1) + 우(2) = 3 이면 두 버튼 모두 눌린 상태
 * - 좌클릭이 눌리는 순간 ReactFlow가 선택 박스(userSelectionRect)를 만들기 때문에,
 *   chord가 감지되면 그 상태를 비워서 고무줄 선택이 그려지지 않게 한다.
 */
export function ChordPanController() {
  const store = useStoreApi();

  useEffect(() => {
    const { domNode } = store.getState();
    if (!domNode) return;

    let panning = false;
    let lastX = 0;
    let lastY = 0;

    const clearSelectionRect = () => {
      if (store.getState().userSelectionRect) {
        store.setState({ userSelectionRect: null, userSelectionActive: false });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const chord = e.buttons === 3; // 좌 + 우 동시
      if (chord) {
        if (!panning) {
          panning = true;
          lastX = e.clientX;
          lastY = e.clientY;
        }
        clearSelectionRect();
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (dx !== 0 || dy !== 0) {
          store.getState().panBy({ x: dx, y: dy });
        }
        e.preventDefault();
      } else if (panning) {
        panning = false;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.buttons === 3) {
        panning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        clearSelectionRect();
      }
    };

    const onPointerUp = () => {
      panning = false;
    };

    // chord 팬 중 우클릭 컨텍스트 메뉴가 뜨지 않게 막는다
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    domNode.addEventListener('pointerdown', onPointerDown);
    domNode.addEventListener('pointermove', onPointerMove);
    domNode.addEventListener('pointerup', onPointerUp);
    domNode.addEventListener('contextmenu', onContextMenu);

    return () => {
      domNode.removeEventListener('pointerdown', onPointerDown);
      domNode.removeEventListener('pointermove', onPointerMove);
      domNode.removeEventListener('pointerup', onPointerUp);
      domNode.removeEventListener('contextmenu', onContextMenu);
    };
  }, [store]);

  return null;
}
