import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 실패 시 보여줄 설명. 어느 부분이 죽었는지 사용자에게 알려준다. */
  label?: string;
  /** 다시 시도 버튼을 눌렀을 때 추가로 할 일 (예: 상태 정리) */
  onRetry?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * 렌더 중 발생한 예외를 잡아 앱 전체가 죽는 것을 막는다.
 *
 * 특히 React.lazy로 코드 분할한 부분에는 반드시 필요하다. Suspense는 "아직 안 온 것"만
 * 처리하고 "영영 못 오는 것"(청크 로드 실패, 오프라인, 배포 후 옛 청크 404)은
 * 그대로 던지기 때문에, 경계가 없으면 화면이 통째로 하얘진다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <div className="text-2xl">⚠️</div>
        <div className="text-sm text-slate-300">
          {this.props.label ?? '이 부분을 불러오지 못했습니다.'}
        </div>
        <div className="text-xs text-slate-500 max-w-xs break-words">{error.message}</div>
        <button
          className="px-3 py-1.5 rounded text-xs bg-indigo-600 text-white hover:bg-indigo-500"
          onClick={this.handleRetry}
        >
          다시 시도
        </button>
      </div>
    );
  }
}
