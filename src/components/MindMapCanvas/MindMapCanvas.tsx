import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '../../store/useMindMapStore';
import { TextNode } from './TextNode';
import { TableNode } from './TableNode';
import { BezierEdge } from './BezierEdge';

const nodeTypes: NodeTypes = {
  textNode: TextNode,
  tableNode: TableNode,
};

const edgeTypes: EdgeTypes = {
  bezierEdge: BezierEdge,
};

export function MindMapCanvas() {
  const { rfNodes, rfEdges, onRfNodesChange, onRfEdgesChange, setSelectedNodeId } =
    useMindMapStore();

  return (
    <div className="flex-1 h-full bg-slate-950">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onRfNodesChange}
        onEdgesChange={onRfEdgesChange}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls />
        <MiniMap nodeColor="#334155" maskColor="rgba(15,23,42,0.7)" />
      </ReactFlow>
    </div>
  );
}
