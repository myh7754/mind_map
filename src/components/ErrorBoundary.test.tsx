import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('청크 로드 실패');
  return <div>정상 내용</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React가 잡힌 예외도 콘솔에 찍기 때문에 테스트 출력이 지저분해진다
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('자식이 정상이면 그대로 렌더한다', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('정상 내용')).toBeInTheDocument();
  });

  it('자식이 던지면 앱을 죽이지 않고 대체 화면을 보여준다', () => {
    render(
      <ErrorBoundary label="노트 에디터를 불러오지 못했습니다.">
        <Boom shouldThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('노트 에디터를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('청크 로드 실패')).toBeInTheDocument();
    expect(screen.queryByText('정상 내용')).not.toBeInTheDocument();
  });

  it('label이 없으면 기본 문구를 쓴다', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText('이 부분을 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('다시 시도를 누르면 복구되고 onRetry가 호출된다', () => {
    const onRetry = vi.fn();

    // 재시도 후 성공하는 상황을 흉내낸다
    function Wrapper() {
      const [fail, setFail] = useState(true);
      return (
        <ErrorBoundary
          onRetry={() => {
            setFail(false);
            onRetry();
          }}
        >
          <Boom shouldThrow={fail} />
        </ErrorBoundary>
      );
    }

    render(<Wrapper />);
    expect(screen.getByText('청크 로드 실패')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('정상 내용')).toBeInTheDocument();
  });
});
