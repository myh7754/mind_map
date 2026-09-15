import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ShowcaseViewer } from './ShowcaseViewer';
import { useAuth } from './hooks/useAuth';
import './index.css';

/**
 * 누가 보느냐로 화면이 갈린다.
 * - 클라우드 켜짐 + 비로그인 → 공개 계정의 공부 기록을 읽기전용으로
 * - 로그인 → 내 계정의 맵을 편집 (계정마다 저장소가 따로)
 * - 클라우드 꺼짐(로컬 개발) → 지금까지처럼 브라우저 저장 앱
 */
function Root() {
  const { session, ready, cloudEnabled } = useAuth();
  if (!ready) return null;
  if (cloudEnabled && !session) return <ShowcaseViewer />;
  const userId = session?.user.id ?? null;
  // key: 계정이 바뀌면 이전 계정의 맵·undo·저장 타이머를 통째로 버리고 새로 시작한다
  return <App key={userId ?? 'local'} userId={userId} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
