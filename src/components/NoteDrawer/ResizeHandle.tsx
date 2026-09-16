import { useCallback, useEffect, useRef } from 'react';

interface ResizeHandleProps {
  onResize: (newWidth: number) => void;
  /** 드로어가 붙은 쪽. 손잡이는 반대편(캔버스 쪽) 가장자리에 놓인다. */
  side: 'left' | 'right';
}

export function ResizeHandle({ onResize, side }: ResizeHandleProps) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current =
        (e.currentTarget.parentElement?.offsetWidth ?? 360);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    []
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current) return;
      // 오른쪽 드로어는 왼쪽으로 끌수록, 왼쪽 드로어는 오른쪽으로 끌수록 넓어진다
      const delta = side === 'right' ? startX.current - e.clientX : e.clientX - startX.current;
      onResize(startWidth.current + delta);
    },
    [onResize, side]
  );

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return (
    <div
      className={`absolute ${side === 'right' ? 'left-0' : 'right-0'} top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-500/50 transition-colors`}
      onPointerDown={onPointerDown}
    />
  );
}
