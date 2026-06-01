import { saveAs } from 'file-saver';
import type { MindMapData } from '../types';

export function downloadJson(mindMapData: MindMapData): void {
  const json = JSON.stringify(mindMapData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, `${mindMapData.title}.mindmap.json`);
}

export function loadJsonFile(): Promise<MindMapData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return reject(new Error('파일이 선택되지 않았습니다.'));
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as MindMapData;
          resolve(data);
        } catch {
          reject(new Error('유효하지 않은 파일입니다.'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
