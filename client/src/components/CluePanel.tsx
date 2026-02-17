import { useState } from 'react';
import { useSocketStore } from '../store/socketStore';

export default function CluePanel() {
  const { gameState, playerName, giveClue } = useSocketStore();
  const [clueWord, setClueWord] = useState('');
  const [clueNumber, setClueNumber] = useState(1);

  if (!gameState) return null;

  const currentPlayer = gameState.players.find(p => p.name === playerName);
  const isSpymaster = currentPlayer?.isSpymaster || false;
  const myTeam = currentPlayer?.team;
  const isMyTurn = myTeam === gameState.currentTeam;

  // 如果不是队长或不是当前回合，只显示当前线索
  if (!isSpymaster || !isMyTurn) {
    return (
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <span className="text-gray-600">当前线索:</span>
            {gameState.currentClue ? (
              <div className="flex items-center gap-2">
                <span className={`
                  px-3 py-1.5 rounded-lg font-semibold text-lg
                  ${gameState.currentClue.team === 'red' 
                    ? 'bg-game-red text-white' 
                    : 'bg-game-blue text-white'}
                `}>
                  {gameState.currentClue.word}
                </span>
                <span className="text-2xl font-bold text-gray-800">
                  {gameState.currentClue.number}
                </span>

              </div>
            ) : (
              <span className="text-gray-400 italic">等待线索...</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 如果有未完成的线索，提示等待（新规则：无次数限制）
  if (gameState.currentClue && gameState.currentClue.team === myTeam) {
    return (
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <span className="text-gray-600">当前线索:</span>
            <div className="flex items-center gap-2">
              <span className={`
                px-3 py-1.5 rounded-lg font-semibold text-lg
                ${gameState.currentClue.team === 'red' 
                  ? 'bg-game-red text-white' 
                  : 'bg-game-blue text-white'}
              `}>
                {gameState.currentClue.word}
              </span>
              <span className="text-2xl font-bold text-gray-800">
                {gameState.currentClue.number}
              </span>
              <span className="text-sm text-gray-500">
                (猜对继续，猜错换队)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 队长输入线索
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clueWord.trim()) return;
    
    giveClue(clueWord.trim(), clueNumber);
    setClueWord('');
    setClueNumber(1);
  };

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center justify-center gap-3">
          <span className="text-gray-600">给出线索:</span>
          
          <input
            type="text"
            value={clueWord}
            onChange={(e) => setClueWord(e.target.value)}
            placeholder="输入提示词"
            maxLength={10}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-32 sm:w-40"
            autoFocus
          />
          
          <select
            value={clueNumber}
            onChange={(e) => setClueNumber(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {Array.from({ length: 10 }, (_, i) => i).map(num => (
              <option key={num} value={num}>
                {num === 0 ? '无限' : num}
              </option>
            ))}
          </select>

          <button
            type="submit"
            disabled={!clueWord.trim()}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-2">
          提示：数字表示与这个词相关的己方词汇数量，队员猜对可继续猜，猜错或主动结束换队
        </p>
      </div>
    </div>
  );
}
