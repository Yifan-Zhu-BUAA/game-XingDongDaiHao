import { useSocketStore } from '../store/socketStore';

export default function PlayerList() {
  const { gameState, playerName } = useSocketStore();

  if (!gameState) return null;

  // 分离入座玩家和观战玩家
  const seatedPlayers = gameState.players.filter(p => p.seatIndex !== null);
  const spectatorPlayers = gameState.players.filter(p => p.seatIndex === null);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        房间玩家 ({gameState.players.length}人)
      </h3>

      {/* 入座玩家 */}
      {seatedPlayers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">游戏中</p>
          <div className="flex flex-wrap gap-2">
            {seatedPlayers.map(player => (
              <div
                key={player.id}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                  player.name === playerName
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <span className="font-medium">{player.name}</span>
                {player.isHost && (
                  <span className="text-xs bg-yellow-400 text-yellow-800 px-1.5 py-0.5 rounded">
                    房主
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  #{player.seatIndex! + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 观战玩家 */}
      {spectatorPlayers.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">观战中</p>
          <div className="flex flex-wrap gap-2">
            {spectatorPlayers.map(player => (
              <div
                key={player.id}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm ${
                  player.name === playerName
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <span className="font-medium">{player.name}</span>
                {player.isHost && (
                  <span className="text-xs bg-yellow-400 text-yellow-800 px-1.5 py-0.5 rounded">
                    房主
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState.players.length === 0 && (
        <p className="text-gray-500 text-sm">暂无玩家</p>
      )}
    </div>
  );
}
