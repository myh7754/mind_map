import type { MindMapData } from '../types';

function blocknoteJsonToMarkdown(noteJson: string): string {
  if (!noteJson) return '';
  try {
    const blocks: { type: string; content?: { text: string }[] }[] = JSON.parse(noteJson);
    return blocks
      .map((block) => {
        const text = (block.content ?? []).map((c) => c.text).join('');
        if (block.type === 'heading') return `**${text}**`;
        if (block.type === 'bulletListItem') return `- ${text}`;
        if (block.type === 'numberedListItem') return `1. ${text}`;
        return text;
      })
      .filter(Boolean)
      .join('\n');
  } catch {
    return noteJson;
  }
}

function buildMarkdown(
  nodeId: string,
  mindMapData: MindMapData,
  depth: number
): string {
  const { nodes, children } = mindMapData;
  const node = nodes[nodeId];
  if (!node) return '';

  const lines: string[] = [];

  if (node.type === 'table' && node.tableData) {
    const { headers, rows } = node.tableData;
    lines.push(`\n| ${headers.join(' | ')} |`);
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      lines.push(`| ${row.join(' | ')} |`);
    }
  } else {
    const heading =
      depth <= 6
        ? `${'#'.repeat(depth)} ${node.label}`
        : `${'  '.repeat(depth - 7)}- ${node.label}`;
    lines.push(heading);
  }

  const noteContent = blocknoteJsonToMarkdown(node.note);
  if (noteContent) lines.push('\n' + noteContent);

  for (const childId of children[nodeId] ?? []) {
    lines.push('\n' + buildMarkdown(childId, mindMapData, depth + 1));
  }

  return lines.join('\n');
}

export function exportToMarkdown(mindMapData: MindMapData): string {
  return buildMarkdown(mindMapData.rootId, mindMapData, 1).trim();
}
