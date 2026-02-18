import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketStore } from '../store/socketStore';
import SeatPanel from '../components/SeatPanel';
import PlayerList from '../components/PlayerList';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { gameState, playerName, leaveRoom, startGame, updateMaxPlayers, joinRoom, isConnected, roomId: storeRoomId, renamePlayer, generateWords, setCustomWords, customWords, isGeneratingWords, error: storeError, clearError } = useSocketStore();
  const [isJoining, setIsJoining] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [showThemeInput, setShowThemeInput] = useState(false);

  // 自动加入房间逻辑
  useEffect(() => {
    // 如果已经通过自动重连加入了（storeRoomId 与 URL 匹配且有 gameState），跳过
    if (gameState && storeRoomId === roomId) return;
    
    // 如果已连接、有房间ID、没有游戏状态、不在加入中、有昵称
    if (isConnected && roomId && !gameState && !isJoining && playerName) {
      setIsJoining(true);
      joinRoom(roomId, playerName).then((success) => {
        if (!success) {
          // 加入失败，返回首页
          navigate('/');
        }
        setIsJoining(false);
      });
    }
    
    // 如果用户没有昵称，重定向到首页输入昵称
    if (isConnected && roomId && !playerName) {
      navigate('/', { state: { redirectRoomId: roomId } });
    }
  }, [isConnected, gameState, roomId, playerName, joinRoom, navigate, isJoining, storeRoomId]);

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
            {/* 昵称编辑 */}
            <div className="mt-1 flex items-center justify-center gap-1">
              {isEditingName ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (editName.trim() && editName.trim() !== playerName) {
                    const ok = await renamePlayer(editName.trim());
                    if (ok) setIsEditingName(false);
                  } else {
                    setIsEditingName(false);
                  }
                }} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    maxLength={4}
                    className="w-20 text-center text-sm border rounded px-1 py-0.5"
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={e => e.key === 'Escape' && setIsEditingName(false)}
                  />
                  <button type="submit" className="text-green-500 text-xs">✓</button>
                </form>
              ) : (
                <button
                  onClick={() => { setEditName(playerName || ''); setIsEditingName(true); }}
                  className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-0.5"
                >
                  <span className="text-gray-600 font-medium">{playerName}</span>
                  <span>✏️</span>
                </button>
              )}
            </div>
          </div>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/room/${roomId}`;
              try {
                // 尝试使用现代 Clipboard API
                if (navigator.clipboard && window.isSecureContext) {
                  await navigator.clipboard.writeText(url);
                  alert('房间链接已复制到剪贴板，分享给好友吧！');
                } else {
                  // 降级方案：使用传统的复制方法
                  const textArea = document.createElement('textarea');
                  textArea.value = url;
                  textArea.style.position = 'fixed';
                  textArea.style.left = '-999999px';
                  textArea.style.top = '-999999px';
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  const successful = document.execCommand('copy');
                  document.body.removeChild(textArea);
                  if (successful) {
                    alert('房间链接已复制到剪贴板，分享给好友吧！');
                  } else {
                    throw new Error('execCommand failed');
                  }
                }
              } catch (err) {
                // 最终降级：显示链接让用户手动复制
                alert(`复制失败，请手动复制链接：\n${url}`);
              }
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

        {/* 自定义主题词汇（仅房主可见） */}
        {isHost && gameState.phase === 'waiting' && (
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">自定义词汇主题</h3>
              <button
                onClick={() => {
                  setShowThemeInput(!showThemeInput);
                  if (showThemeInput) {
                    setCustomWords(null);
                    setThemeInput('');
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showThemeInput ? '使用默认词库' : '自定义主题'}
              </button>
            </div>
            
            {showThemeInput && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={themeInput}
                    onChange={(e) => {
                      setThemeInput(e.target.value);
                      if (storeError) clearError();
                    }}
                    placeholder="输入主题，如：大海和天空"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={50}
                  />
                  <button
                    onClick={() => generateWords(themeInput)}
                    disabled={!themeInput.trim() || isGeneratingWords}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {isGeneratingWords ? '生成中...' : '生成词汇'}
                  </button>
                </div>
                
                {/* 错误提示 */}
                {storeError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs text-red-700">
                      ⚠️ {storeError}
                    </p>
                  </div>
                )}
                
                {customWords && customWords.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-green-700 mb-2 font-medium">已生成{customWords.length}个词汇：</p>
                    <div className="flex flex-wrap gap-2">
                      {customWords.map((word, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-white text-green-800 text-xs rounded border border-green-200"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!showThemeInput && (
              <p className="text-xs text-gray-500">
                使用默认词库（网络热梗、游戏、影视等词汇）
              </p>
            )}
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
