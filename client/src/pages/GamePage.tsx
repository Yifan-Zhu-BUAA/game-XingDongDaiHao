import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketStore } from '../store/socketStore';
import GameBoard from '../components/GameBoard';
import CluePanel from '../components/CluePanel';
import ScoreBoard from '../components/ScoreBoard';
import GameOverModal from '../components/GameOverModal';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { 
    gameState, 
    playerName, 
    leaveRoom, 
    restartGame, 
    endTurn,
    lastGuessResult,
    renamePlayer,
  } = useSocketStore();

  const [showGameOver, setShowGameOver] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  // 监听游戏结束
  useEffect(() => {
    if (gameState?.phase === 'ended') {
      setShowGameOver(true);
    }
  }, [gameState?.phase]);

  // 监听游戏重新开始
  useEffect(() => {
    if (gameState?.phase === 'waiting') {
      setShowGameOver(false);
      navigate(`/room/${roomId}`);
    }
  }, [gameState?.phase, roomId, navigate]);

  // 返回房间（观战或等待）
  const handleBackToRoom = () => {
    navigate(`/room/${roomId}`);
  };

  // 离开游戏
  const handleLeave = () => {
    if (confirm('确定要离开游戏吗？')) {
      leaveRoom();
      navigate('/');
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

  const currentPlayer = gameState.players.find(p => p.name === playerName);
  const isHost = currentPlayer?.isHost || false;
  const isSpymaster = currentPlayer?.isSpymaster || false;
  const myTeam = currentPlayer?.team;
  const isMyTurn = myTeam === gameState.currentTeam;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToRoom}
              className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <span>←</span> 返回房间
            </button>
            
            <div className="text-center">
              <h1 className="text-lg font-bold text-gray-800">行动代号</h1>
              <p className="text-xs text-gray-500">房间: {roomId}</p>
            </div>

            {/* 身份标识 + 昵称 */}
            <div className="flex items-center gap-2">
              {currentPlayer?.seatIndex !== null && currentPlayer?.seatIndex !== undefined ? (
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  isMyTurn ? 'animate-pulse ' : ''
                }${
                  isSpymaster
                    ? (myTeam === 'red' 
                        ? 'bg-red-500 text-white' 
                        : 'bg-blue-500 text-white')
                    : (myTeam === 'red'
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-blue-100 text-blue-700 border border-blue-300')
                }`}>
                  {myTeam === 'red' ? '🔴' : '🔵'} {myTeam === 'red' ? '红' : '蓝'}队{isSpymaster ? '队长' : '队员'}
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-300">
                  👁 观战中
                </span>
              )}
              {/* 昵称编辑 */}
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
                    className="w-16 text-center text-xs border rounded px-1 py-0.5"
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={e => e.key === 'Escape' && setIsEditingName(false)}
                  />
                </form>
              ) : (
                <button
                  onClick={() => { setEditName(playerName || ''); setIsEditingName(true); }}
                  className="text-xs text-gray-400 hover:text-blue-500"
                  title="点击修改昵称"
                >
                  {playerName} ✏️
                </button>
              )}
              <button
                onClick={handleLeave}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 计分板 */}
      <ScoreBoard />

      {/* 线索面板 */}
      <CluePanel />

      {/* 游戏主区域 */}
      <main className="max-w-6xl mx-auto px-4 py-4">
        <GameBoard />

        {/* 操作提示 */}
        {currentPlayer?.seatIndex !== null && (
          <div className="mt-4 text-center">
            {isSpymaster ? (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-800 font-medium">
                  你是{myTeam === 'red' ? '红' : '蓝'}队队长
                </p>
                <p className="text-purple-600 text-sm mt-1">
                  {isMyTurn 
                    ? '请给出线索（格式：词 + 数字）' 
                    : '等待对方队长给出线索...'}
                </p>
              </div>
            ) : (
              <div className={`rounded-lg p-4 ${
                isMyTurn 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`font-medium ${
                  isMyTurn ? 'text-green-800' : 'text-gray-600'
                }`}>
                  {isMyTurn 
                    ? `轮到${myTeam === 'red' ? '红' : '蓝'}队猜词！` 
                    : `等待${gameState.currentTeam === 'red' ? '红' : '蓝'}队猜词...`}
                </p>
                {isMyTurn && gameState.currentClue && (
                  <div className="mt-2 flex items-center justify-center gap-4">
                    <span className="text-green-600 text-sm">
                      猜对继续猜，猜错换队
                    </span>
                    <button
                      onClick={endTurn}
                      className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition"
                    >
                      结束回合
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 观战提示 */}
        {currentPlayer?.seatIndex === null && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-yellow-800">
              你正在观战
            </p>
            <p className="text-yellow-600 text-sm mt-1">
              {gameState.currentTeam === 'red' ? '红' : '蓝'}队正在行动
            </p>
          </div>
        )}
      </main>

      {/* 猜测结果提示 */}
      {lastGuessResult && (
        <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${
          lastGuessResult.cardType === 'black' 
            ? 'bg-gray-800 text-white'
            : lastGuessResult.cardType === 'red'
            ? 'bg-game-red text-white'
            : lastGuessResult.cardType === 'blue'
            ? 'bg-game-blue text-white'
            : 'bg-gray-200 text-gray-800'
        }`}>
          <p className="font-medium">
            {lastGuessResult.cardType === 'black' 
              ? '💀 猜中黑牌！游戏结束'
              : lastGuessResult.cardType === 'white'
              ? '⚪ 白牌！回合结束'
              : lastGuessResult.continueTurn
              ? `✅ ${lastGuessResult.cardWord} - 猜对了！继续猜`
              : `❌ ${lastGuessResult.cardWord} - 猜错了！换队`}
          </p>
        </div>
      )}

      {/* 游戏结束弹窗 */}
      {showGameOver && (
        <GameOverModal 
          onClose={() => setShowGameOver(false)}
          onRestart={restartGame}
          isHost={isHost}
        />
      )}
    </div>
  );
}
