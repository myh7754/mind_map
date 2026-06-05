import { useCallback, useEffect, useRef } from 'react';

interface ResizeHandleProps {
  onResize: (newWidth: number) => void;
}

export function ResizeHandle({ onResize }: ResizeHandleProps) {
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
      const delta = startX.current - e.clientX;
      onResize(startWidth.current + delta);
    },
    [onResize]
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
      className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-500/50 transition-colors"
      onPointerDown={onPointerDown}
    />
  );
}
