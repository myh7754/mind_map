import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMindMapStore } from '../../store/useMindMapStore';
import { TextNode } from './TextNode';
import { TableNode } from './TableNode';
import { BezierEdge } from './BezierEdge';
import { ChordPanController } from './ChordPanController';

const nodeTypes: NodeTypes = {
  textNode: TextNode,
  tableNode: TableNode,
};

const edgeTypes: EdgeTypes = {
  bezierEdge: BezierEdge,
};

export function MindMapCanvas() {
  const { rfNodes, rfEdges, onRfNodesChange, onRfEdgesChange, setSelectedNodeId, deleteNodes } =
    useMindMapStore();

  const handleNodesDelete = (deleted: Node[]) => {
    deleteNodes(deleted.map((n) => n.id));
  };

  return (
    <div className="flex-1 h-full bg-slate-950">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onRfNodesChange}
        onEdgesChange={onRfEdgesChange}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        onNodesDelete={handleNodesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        /* 자동 정렬 고정: 개별 노드 자유 이동 금지 (dagre가 형태 유지) */
        nodesDraggable={false}
        /* 좌클릭 드래그 = 박스 선택 (여러 노드 선택) */
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null}
        /* 네이티브 단일버튼 팬은 끔. 화면 이동은 좌+우 동시 드래그(ChordPanController)로 처리 */
        panOnDrag={false}
        /* Delete/Backspace로 선택된 노드 삭제 */
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <ChordPanController />
        <Background color="#334155" gap={20} size={1} />
        <Controls />
        <MiniMap nodeColor="#334155" maskColor="rgba(15,23,42,0.7)" />
      </ReactFlow>
    </div>
  );
}
