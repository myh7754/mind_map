import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

/**
 * 파일 입출력은 브라우저 다운로드/파일 선택창을 띄운다 — jsdom에서는 흉내낼 수
 * 없으므로 그 경계만 가짜로 둔다. 검증 대상은 "어느 메뉴 항목이 어느 기능에
 * 연결됐는가"다. 툴바에서 메뉴로 옮기면서 배선이 어긋나는 게 이 작업의 실제 위험.
 */
vi.mock('../../utils/exportJson', () => ({
  downloadJson: vi.fn(),
  loadJsonFile: vi.fn().mockResolvedValue({ id: 'x', title: 'x', rootId: 'r', children: { r: [] }, nodes: {} }),
}));
vi.mock('../../utils/exportMarkdown', () => ({ exportToMarkdown: vi.fn(() => '# md') }));
vi.mock('../../utils/importMarkdown', () => ({
  importFromMarkdown: vi.fn(),
  pickTextFile: vi.fn().mockResolvedValue({ name: 'a.md', text: '# a' }),
}));
vi.mock('../../utils/exportImage', () => ({ exportToPng: vi.fn().mockResolvedValue(undefined) }));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

import { FileMenu } from './FileMenu';
import { downloadJson, loadJsonFile } from '../../utils/exportJson';
import { exportToMarkdown } from '../../utils/exportMarkdown';
import { pickTextFile } from '../../utils/importMarkdown';
import { exportToPng } from '../../utils/exportImage';

function openMenu() {
  render(<FileMenu />);
  fireEvent.click(screen.getByRole('button', { name: /파일/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FileMenu', () => {
  it('처음에는 항목이 접혀 있다', () => {
    render(<FileMenu />);
    expect(screen.queryByText('JSON 저장')).not.toBeInTheDocument();
  });

  it('다섯 가지 입출력이 모두 들어 있다', () => {
    openMenu();
    for (const label of ['열기', 'JSON 저장', 'MD 가져오기', 'MD 내보내기', 'PNG로 저장']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('JSON 저장 → downloadJson', () => {
    openMenu();
    fireEvent.click(screen.getByText('JSON 저장'));
    expect(downloadJson).toHaveBeenCalledTimes(1);
  });

  // 이 항목만 비동기다 (파일 선택 후 스토어를 갱신한다) — 후속 상태 변경까지 기다린다
  it('열기 → loadJsonFile', async () => {
    openMenu();
    await act(async () => {
      fireEvent.click(screen.getByText('열기'));
    });
    expect(loadJsonFile).toHaveBeenCalledTimes(1);
  });

  it('MD 내보내기 → exportToMarkdown', () => {
    openMenu();
    fireEvent.click(screen.getByText('MD 내보내기'));
    expect(exportToMarkdown).toHaveBeenCalledTimes(1);
  });

  it('MD 가져오기 → pickTextFile', () => {
    openMenu();
    fireEvent.click(screen.getByText('MD 가져오기'));
    expect(pickTextFile).toHaveBeenCalledTimes(1);
  });

  it('PNG로 저장 → exportToPng', () => {
    openMenu();
    fireEvent.click(screen.getByText('PNG로 저장'));
    expect(exportToPng).toHaveBeenCalledTimes(1);
  });

  it('고르면 메뉴가 닫힌다', () => {
    openMenu();
    fireEvent.click(screen.getByText('JSON 저장'));
    expect(screen.queryByText('PNG로 저장')).not.toBeInTheDocument();
  });
});
