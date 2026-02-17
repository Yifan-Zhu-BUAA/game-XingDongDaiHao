import { useSocketStore } from '../store/socketStore';

interface GameOverModalProps {
  onClose: () => void;
  onRestart: () => Promise<boolean>;
  isHost: boolean;
}

export default function GameOverModal({ onClose, onRestart, isHost }: GameOverModalProps) {
  const { gameState } = useSocketStore();

  if (!gameState || !gameState.winner) return null;

  const handleRestart = async () => {
    const success = await onRestart();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in duration-300">
        {/* 胜利图标 */}
        <div className="text-6xl mb-4">
          {gameState.winner === 'red' ? '🎉' : '🎊'}
        </div>

        {/* 标题 */}
        <h2 className="text-3xl font-bold mb-2">
          {gameState.winner === 'red' ? (
            <span className="text-game-red">红队获胜！</span>
          ) : (
            <span className="text-game-blue">蓝队获胜！</span>
          )}
        </h2>

        {/* 比分 */}
        <div className="flex items-center justify-center gap-4 my-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-game-red">{gameState.redScore}</div>
            <div className="text-xs text-gray-500">红队</div>
          </div>
          <div className="text-gray-400">:</div>
          <div className="text-center">
            <div className="text-2xl font-bold text-game-blue">{gameState.blueScore}</div>
            <div className="text-xs text-gray-500">蓝队</div>
          </div>
        </div>

        {/* 结束原因 */}
        <p className="text-gray-600 mb-6">
          {gameState.redScore >= gameState.redTotal || gameState.blueScore >= gameState.blueTotal
            ? '成功找出了所有己方词汇！'
            : '对方猜中了黑牌！'}
        </p>

        {/* 按钮 */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            查看结果
          </button>
          
          {isHost && (
            <button
              onClick={handleRestart}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              重新开始
            </button>
          )}
        </div>

        {!isHost && (
          <p className="text-sm text-gray-400 mt-4">
            等待房主重新开始游戏...
          </p>
        )}
      </div>
    </div>
  );
}
