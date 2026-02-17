import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useSocketStore } from './store/socketStore';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import GamePage from './pages/GamePage';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connect, disconnect, isConnected, error, clearError, gameState, roomId } = useSocketStore();

  // 连接 Socket.io
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // 自动恢复页面：重连成功后，根据游戏状态跳转到正确页面
  useEffect(() => {
    if (!isConnected || !gameState || !roomId) return;
    
    // 只在首页时自动跳转（避免干扰正常导航）
    if (location.pathname === '/') {
      if (gameState.phase === 'playing' || gameState.phase === 'ended') {
        navigate(`/game/${roomId}`);
      } else {
        navigate(`/room/${roomId}`);
      }
    }
  }, [isConnected, gameState, roomId, navigate, location.pathname]);

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
