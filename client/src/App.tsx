import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useSocketStore } from './store/socketStore';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import GamePage from './pages/GamePage';

function App() {
  const location = useLocation();
  const { connect, disconnect, isConnected, error, clearError } = useSocketStore();

  // 连接 Socket.io
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // 自动清除错误提示
  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 连接状态提示 */}
      {!isConnected && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50">
          正在连接服务器...
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-50">
          {error}
          <button 
            onClick={clearError}
            className="ml-2 text-sm underline"
          >
            关闭
          </button>
        </div>
      )}

      {/* 页面内容 */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/game/:roomId" element={<GamePage />} />
      </Routes>
    </div>
  );
}

export default App;
