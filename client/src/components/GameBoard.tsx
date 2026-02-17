import { useSocketStore } from '../store/socketStore';
import { CardType } from '../types';

export default function GameBoard() {
  const { gameState, playerName, guessCard } = useSocketStore();

  if (!gameState) return null;

  const currentPlayer = gameState.players.find(p => p.name === playerName);
  const isSpymaster = currentPlayer?.isSpymaster || false;
  const myTeam = currentPlayer?.team;
  const isMyTurn = myTeam === gameState.currentTeam && !isSpymaster;

  // 获取卡片样式
  const getCardStyle = (type: CardType, revealed: boolean): string => {
    if (!revealed) {
      // 未翻开
      if (isSpymaster || currentPlayer?.seatIndex === null) {
        // 队长或观战者可以看到颜色（半透明）
        switch (type) {
          case 'red': return 'bg-red-200 border-red-400';
          case 'blue': return 'bg-blue-200 border-blue-400';
          case 'white': return 'bg-gray-100 border-gray-300';
          case 'black': return 'bg-gray-400 border-gray-600';
          default: return 'bg-white border-gray-300';
        }
      }
      return 'bg-white border-gray-300 hover:border-gray-400';
    }

    // 已翻开
    switch (type) {
      case 'red': return 'bg-game-red text-white border-game-red';
      case 'blue': return 'bg-game-blue text-white border-game-blue';
      case 'white': return 'bg-game-white text-gray-800 border-gray-300';
      case 'black': return 'bg-game-black text-white border-game-black';
      default: return 'bg-white border-gray-300';
    }
  };

  // 是否可以点击（新规则：-1表示无次数限制）
  const canClick = (revealed: boolean): boolean => {
    if (revealed) return false;
    if (!isMyTurn) return false;
    if (gameState.remainingGuesses === 0) return false; // 只有明确为0时才禁止
    return true;
  };

  // 处理点击
  const handleCardClick = (index: number, revealed: boolean) => {
    if (!canClick(revealed)) return;
    guessCard(index);
  };

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {gameState.cards.map((card, index) => {
        const cardStyle = getCardStyle(card.type as CardType, card.revealed);
        const clickable = canClick(card.revealed);

        return (
          <button
            key={card.id}
            onClick={() => handleCardClick(index, card.revealed)}
            disabled={!clickable}
            className={`
              relative aspect-square rounded-lg border-2 p-1 sm:p-2
              flex flex-col items-center justify-center
              transition-all duration-200
              ${cardStyle}
              ${clickable ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-default'}
              ${card.revealed ? 'opacity-80' : 'opacity-100'}
            `}
          >
            {/* 词语 */}
            <span className={`
              text-center font-medium leading-tight
              ${card.revealed 
                ? 'text-sm sm:text-base text-white' 
                : 'text-xs sm:text-sm text-gray-800'
              }
            `}>
              {card.word}
            </span>

            {/* 已翻开标记 */}
            {card.revealed && (
              <div className="absolute inset-0 flex items-center justify-center">
                {card.type === 'red' && (
                  <span className="text-3xl sm:text-4xl opacity-30">🔴</span>
                )}
                {card.type === 'blue' && (
                  <span className="text-3xl sm:text-4xl opacity-30">🔵</span>
                )}
                {card.type === 'white' && (
                  <span className="text-2xl sm:text-3xl opacity-50">⭕</span>
                )}
                {card.type === 'black' && (
                  <span className="text-3xl sm:text-4xl">💀</span>
                )}
              </div>
            )}

            {/* 队长标记（仅队长和观战者可见） */}
            {!card.revealed && (isSpymaster || currentPlayer?.seatIndex === null) && (
              <div className="absolute top-1 right-1">
                {card.type === 'red' && (
                  <span className="text-xs">🔴</span>
                )}
                {card.type === 'blue' && (
                  <span className="text-xs">🔵</span>
                )}
                {card.type === 'black' && (
                  <span className="text-xs">⚫</span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
