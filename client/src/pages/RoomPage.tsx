import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketStore } from '../store/socketStore';
import SeatPanel from '../components/SeatPanel';
import PlayerList from '../components/PlayerList';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { gameState, playerName, leaveRoom, startGame, updateMaxPlayers } = useSocketStore();

  // 如果没有游戏状态，返回首页
  useEffect(() => {
    if (!gameState && roomId) {
      // 可能页面刷新了，需要重新加入
      // 这里可以添加重新加入逻辑
    }
  }, [gameState, roomId]);

  // 监听游戏开始
  useEffect(() => {
    if (gameState?.phase === 'playing') {
      navigate(`/game/${roomId}`);
    }
  }, [gameState?.phase, roomId, navigate]);

  // 返回首页
  const handleLeave = () => {
    if (confirm('确定要离开房间吗？')) {
      leaveRoom();
      navigate('/');
    }
  };

  // 获取当前玩家
  const currentPlayer = gameState?.players.find(
    p => p.name === playerName
  );

  // 获取已入座玩家数
  const seatedCount = gameState?.players.filter(p => p.seatIndex !== null).length || 0;

  // 获取是否是房主
  const isHost = currentPlayer?.isHost || false;

  // 是否可以开始游戏
  const canStart = seatedCount >= 2 && isHost && gameState?.phase === 'waiting';

  // 获取座位说明
  const getSeatDescription = (maxPlayers: number) => {
    switch (maxPlayers) {
      case 2:
        return '2人游戏：玩家1是红队长，玩家2猜红队词（每回合需主动翻开一张蓝牌）';
      case 3:
        return '3人游戏：玩家1红队长，玩家2蓝队长，玩家3双面间谍（猜两队词）';
      case 4:
        return '4人游戏：玩家1红队长，玩家2蓝队长，玩家3猜红队，玩家4猜蓝队';
      default:
        return `${maxPlayers}人游戏：1号红队长，2号蓝队长，其余轮流分配队伍`;
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* 顶部导航 */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={handleLeave}
            className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
          >
            <span>←</span> 返回主页
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-800">行动代号</h1>
            <p className="text-sm text-gray-500">房间号: {roomId}</p>
          </div>
          <button
            onClick={() => {
              const url = `${window.location.origin}/room/${roomId}`;
              navigator.clipboard.writeText(url);
              alert('房间链接已复制到剪贴板，分享给好友吧！');
            }}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            邀请好友
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* 座位面板 */}
        <SeatPanel />

        {/* 人数选择（仅房主可见） */}
        {isHost && gameState.phase === 'waiting' && (
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">选择游戏人数</h3>
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 4, 5, 6, 7, 8].map(num => (
                <button
                  key={num}
                  onClick={() => updateMaxPlayers(num)}
                  disabled={seatedCount > num}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    gameState.maxPlayers === num
                      ? 'bg-blue-500 text-white'
                      : seatedCount > num
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {num}人
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {getSeatDescription(gameState.maxPlayers)}
            </p>
          </div>
        )}

        {/* 非房主的提示 */}
        {!isHost && gameState.phase === 'waiting' && (
          <div className="mt-6 bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-blue-700 text-sm">
              等待房主开始游戏...
            </p>
            <p className="text-xs text-blue-500 mt-1">
              {getSeatDescription(gameState.maxPlayers)}
            </p>
          </div>
        )}

        {/* 开始游戏按钮 */}
        {isHost && (
          <div className="mt-6">
            <button
              onClick={startGame}
              disabled={!canStart}
              className={`w-full py-4 rounded-lg font-semibold text-lg transition ${
                canStart
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {seatedCount < 2 ? '至少需要2人入座' : '开始游戏'}
            </button>
          </div>
        )}

        {/* 观战玩家列表 */}
        <div className="mt-6">
          <PlayerList />
        </div>
      </div>
    </div>
  );
}
