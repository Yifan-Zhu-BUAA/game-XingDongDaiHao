import { useSocketStore } from '../store/socketStore';

export default function ScoreBoard() {
  const { gameState } = useSocketStore();

  if (!gameState) return null;

  const redProgress = (gameState.redScore / gameState.redTotal) * 100;
  const blueProgress = (gameState.blueScore / gameState.blueTotal) * 100;

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {/* 红队 */}
          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-game-red flex items-center gap-1">
                🔴 红队
                {gameState.currentTeam === 'red' && (
                  <span className="text-xs bg-yellow-400 text-yellow-800 px-1.5 py-0.5 rounded animate-pulse">
                    回合
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-600">
                {gameState.redScore} / {gameState.redTotal}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-game-red transition-all duration-500"
                style={{ width: `${redProgress}%` }}
              />
            </div>
          </div>

          {/* VS */}
          <div className="text-xl font-bold text-gray-400">VS</div>

          {/* 蓝队 */}
          <div className="flex-1 max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-game-blue flex items-center gap-1">
                🔵 蓝队
                {gameState.currentTeam === 'blue' && (
                  <span className="text-xs bg-yellow-400 text-yellow-800 px-1.5 py-0.5 rounded animate-pulse">
                    回合
                  </span>
                )}
              </span>
              <span className="text-sm text-gray-600">
                {gameState.blueScore} / {gameState.blueTotal}
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-game-blue transition-all duration-500"
                style={{ width: `${blueProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
