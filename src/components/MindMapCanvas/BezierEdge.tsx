import type { EdgeProps } from '@xyflow/react';
import type { MindMapEdge } from '../../types';

const EDGE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export function BezierEdge({
  sourceX, sourceY, targetX, targetY,
  data,
}: EdgeProps<MindMapEdge['data']>) {
  const depth = data?.depth ?? 0;
  const isPreview = data?.preview ?? false;
  const color = isPreview ? '#f59e0b' : EDGE_COLORS[Math.min(depth, EDGE_COLORS.length - 1)];
  const strokeWidth = isPreview ? 2.5 : depth === 0 ? 2 : depth === 1 ? 1.5 : 1;

  const d = `M ${sourceX} ${sourceY} C ${sourceX + 60} ${sourceY}, ${targetX - 60} ${targetY}, ${targetX} ${targetY}`;

  return (
    <path
      d={d}
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={isPreview ? '6 4' : undefined}
      opacity={isPreview ? 0.95 : 1}
    />
  );
}
