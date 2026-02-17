import { useSocketStore } from '../store/socketStore';

export default function SeatPanel() {
  const { gameState, playerName, takeSeat, leaveSeat, switchSeat } = useSocketStore();

  if (!gameState) return null;

  const currentPlayer = gameState.players.find(p => p.name === playerName);
  const isSeated = currentPlayer?.seatIndex !== null;

  // 获取座位上的玩家
  const getSeatPlayer = (index: number) => {
    return gameState.players.find(p => p.seatIndex === index);
  };

  // 获取座位角色说明
  const getSeatRole = (index: number) => {
    const seatNum = index + 1;
    switch (gameState.maxPlayers) {
      case 2:
        if (seatNum === 1) return { role: '红队长', team: 'red' as const };
        if (seatNum === 2) return { role: '红队员', team: 'red' as const };
        break;
      case 3:
        if (seatNum === 1) return { role: '红队长', team: 'red' as const };
        if (seatNum === 2) return { role: '蓝队长', team: 'blue' as const };
        if (seatNum === 3) return { role: '双面间谍', team: 'both' as const };
        break;
      case 4:
      default:
        if (seatNum === 1) return { role: '红队长', team: 'red' as const };
        if (seatNum === 2) return { role: '蓝队长', team: 'blue' as const };
        if (seatNum % 2 === 1) return { role: '红队员', team: 'red' as const };
        if (seatNum % 2 === 0) return { role: '蓝队员', team: 'blue' as const };
        break;
    }
    return { role: '队员', team: null };
  };

  // 获取队伍颜色
  const getTeamColor = (team: string | null) => {
    switch (team) {
      case 'red': return 'bg-game-red text-white';
      case 'blue': return 'bg-game-blue text-white';
      case 'both': return 'bg-gradient-to-r from-game-red to-game-blue text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">选择座位</h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: gameState.maxPlayers }).map((_, index) => {
          const seatPlayer = getSeatPlayer(index);
          const { role, team } = getSeatRole(index);
          const isCurrentSeat = currentPlayer?.seatIndex === index;

          return (
            <div
              key={index}
              className={`relative border-2 rounded-lg p-3 transition ${
                isCurrentSeat
                  ? 'border-blue-500 bg-blue-50'
                  : seatPlayer
                  ? 'border-gray-300 bg-gray-100'
                  : 'border-dashed border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              {/* 座位号 */}
              <div className="absolute top-1 left-2 text-xs text-gray-400">
                {index + 1}
              </div>

              {/* 角色标签 */}
              <div className={`absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded ${getTeamColor(team)}`}>
                {role}
              </div>

              {/* 座位内容 */}
              <div className="mt-4 text-center">
                {seatPlayer ? (
                  <>
                    <div className="text-2xl mb-1">
                      {seatPlayer.name.slice(0, 2)}
                    </div>
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {seatPlayer.name}
                    </div>
                    {seatPlayer.isHost && (
                      <div className="text-xs text-yellow-600 mt-1">房主</div>
                    )}
                  </>
                ) : (
                  <div className="text-gray-400 py-2">空座位</div>
                )}
              </div>

              {/* 操作按钮 */}
              {gameState.phase === 'waiting' && (
                <div className="mt-2">
                  {isCurrentSeat ? (
                    <button
                      onClick={leaveSeat}
                      className="w-full py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
                    >
                      离座
                    </button>
                  ) : !isSeated && !seatPlayer ? (
                    <button
                      onClick={() => takeSeat(index)}
                      className="w-full py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                      入座
                    </button>
                  ) : isSeated && seatPlayer ? (
                    <button
                      onClick={() => switchSeat(index)}
                      className="w-full py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                    >
                      换位
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 观战区 */}
      {isSeated && (
        <div className="mt-4 text-center">
          <button
            onClick={leaveSeat}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            离开座位，进入观战
          </button>
        </div>
      )}
    </div>
  );
}
