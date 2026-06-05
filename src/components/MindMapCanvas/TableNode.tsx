import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { MindMapNode } from '../../types';
import { useMindMapStore } from '../../store/useMindMapStore';

export const TableNode = memo(function TableNode({ data, id }: NodeProps<MindMapNode>) {
  const { updateNodeTableData, openNoteDrawer, deleteNode } = useMindMapStore();
  const tableData = data.tableData ?? { headers: ['컬럼 1', '컬럼 2'], rows: [['', '']] };

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const newRows = tableData.rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : row
    );
    updateNodeTableData(id, { ...tableData, rows: newRows });
  };

  const updateHeader = (colIdx: number, value: string) => {
    const newHeaders = tableData.headers.map((h, i) => (i === colIdx ? value : h));
    updateNodeTableData(id, { ...tableData, headers: newHeaders });
  };

  const addRow = () => {
    updateNodeTableData(id, {
      ...tableData,
      rows: [...tableData.rows, tableData.headers.map(() => '')],
    });
  };

  const addColumn = () => {
    updateNodeTableData(id, {
      headers: [...tableData.headers, `컬럼 ${tableData.headers.length + 1}`],
      rows: tableData.rows.map((row) => [...row, '']),
    });
  };

  return (
    <div className="group relative bg-slate-800 border border-slate-600 rounded-lg p-2 min-w-[200px]">
      <Handle type="target" position={Position.Left} className="!opacity-0" />

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">📊 {data.label}</span>
        <div className="hidden group-hover:flex gap-1">
          <button
            className="text-xs px-1 rounded bg-indigo-600 text-white"
            onClick={() => openNoteDrawer(id)}
          >
            📝
          </button>
          <button
            className="text-xs px-1 rounded bg-slate-600 text-white"
            onClick={() => deleteNode(id)}
          >
            ✕
          </button>
        </div>
      </div>

      <table className="text-xs w-full border-collapse">
        <thead>
          <tr>
            {tableData.headers.map((header, ci) => (
              <th key={ci} className="border border-slate-600 p-1">
                <input
                  className="bg-transparent text-slate-200 font-semibold w-full outline-none min-w-[60px]"
                  value={header}
                  onChange={(e) => updateHeader(ci, e.target.value)}
                />
              </th>
            ))}
            <th className="border border-slate-700 p-1">
              <button className="text-slate-500 hover:text-slate-300" onClick={addColumn}>
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-slate-700 p-1">
                  <input
                    className="bg-transparent text-slate-300 w-full outline-none min-w-[60px]"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                  />
                </td>
              ))}
              <td className="border border-slate-700" />
            </tr>
          ))}
          <tr>
            <td
              colSpan={tableData.headers.length + 1}
              className="border border-slate-700 p-1 text-center"
            >
              <button
                className="text-slate-500 hover:text-slate-300 text-xs"
                onClick={addRow}
              >
                + 행 추가
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
});
