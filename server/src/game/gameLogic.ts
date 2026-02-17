import { GameState, Card, CardType, Team, Player, Clue, GuessRecord, RoomConfig } from './types.js';
import { getRandomWords } from './words.js';

// 游戏常量
const GRID_SIZE = 25; // 5x5 格子
const RED_CARDS = 9;
const BLUE_CARDS = 8;
const WHITE_CARDS = 7;
const BLACK_CARDS = 1;

// 生成唯一ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 生成房间ID（4位字母数字）
export function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 创建初始游戏状态
export function createGameState(roomId: string, maxPlayers: number = 4): GameState {
  return {
    roomId,
    phase: 'waiting',
    players: [],
    cards: [],
    currentTeam: 'red',
    currentClue: null,
    redScore: 0,
    blueScore: 0,
    redTotal: RED_CARDS,
    blueTotal: BLUE_CARDS,
    winner: null,
    maxPlayers,
    remainingGuesses: 0,
    guessHistory: [],
    clueHistory: [],
    createdAt: Date.now(),
    startedAt: null,
    endedAt: null,
  };
}

// 创建卡片
function createCards(): Card[] {
  const words = getRandomWords(GRID_SIZE);
  const cards: Card[] = [];
  
  // 确定哪方先手（先手方有9张，后手方8张）
  const firstTeam: CardType = Math.random() > 0.5 ? 'red' : 'blue';
  const firstTeamCount = 9;
  const secondTeamCount = 8;
  
  // 创建卡片类型数组
  const types: CardType[] = [];
  
  // 添加先手方卡片
  for (let i = 0; i < firstTeamCount; i++) {
    types.push(firstTeam);
  }
  
  // 添加后手方卡片
  const secondTeam: CardType = firstTeam === 'red' ? 'blue' : 'red';
  for (let i = 0; i < secondTeamCount; i++) {
    types.push(secondTeam);
  }
  
  // 添加白牌
  for (let i = 0; i < WHITE_CARDS; i++) {
    types.push('white');
  }
  
  // 添加黑牌
  types.push('black');
  
  // 打乱顺序
  const shuffledTypes = types.sort(() => Math.random() - 0.5);
  
  // 创建卡片
  for (let i = 0; i < GRID_SIZE; i++) {
    cards.push({
      id: i,
      word: words[i],
      type: shuffledTypes[i],
      revealed: false,
    });
  }
  
  return cards;
}

// 开始游戏
export function startGame(state: GameState): GameState {
  if (state.players.length < 2) {
    throw new Error('至少需要2名玩家');
  }
  
  // 分配队伍和角色
  const seatedPlayers = state.players.filter(p => p.seatIndex !== null);
  const newPlayers = assignTeamsAndRoles(seatedPlayers, state.maxPlayers);
  
  // 创建卡片
  const cards = createCards();
  
  // 确定先手（牌多的一方先手）
  const redCount = cards.filter(c => c.type === 'red').length;
  const blueCount = cards.filter(c => c.type === 'blue').length;
  const firstTeam: Team = redCount > blueCount ? 'red' : 'blue';
  
  return {
    ...state,
    phase: 'playing',
    players: newPlayers,
    cards,
    currentTeam: firstTeam,
    currentClue: null,
    redScore: 0,
    blueScore: 0,
    redTotal: redCount,
    blueTotal: blueCount,
    winner: null,
    remainingGuesses: 0,
    guessHistory: [],
    clueHistory: [],
    startedAt: Date.now(),
    endedAt: null,
  };
}

// 分配队伍和角色
function assignTeamsAndRoles(players: Player[], maxPlayers: number): Player[] {
  const newPlayers = [...players];
  
  // 根据人数确定队伍配置
  // 4人：红队长(1)、蓝队长(2)、红队员(3)、蓝队员(4)
  // 其他人数类似分配
  
  switch (maxPlayers) {
    case 2:
      // 2人：玩家1红队长，玩家2猜红队词（每回合需主动翻一张蓝牌）
      newPlayers[0].team = 'red';
      newPlayers[0].isSpymaster = true;
      newPlayers[1].team = 'red';
      newPlayers[1].isSpymaster = false;
      break;
      
    case 3:
      // 3人：玩家1红队长，玩家2蓝队长，玩家3双面间谍
      newPlayers[0].team = 'red';
      newPlayers[0].isSpymaster = true;
      newPlayers[1].team = 'blue';
      newPlayers[1].isSpymaster = true;
      newPlayers[2].team = 'red'; // 双面间谍主要猜红队，但会辅助
      newPlayers[2].isSpymaster = false;
      break;
      
    case 4:
    default:
      // 4人及以上标准模式
      // 1号红队长，2号蓝队长，3号红队员，4号蓝队员
      for (let i = 0; i < newPlayers.length; i++) {
        const seatNum = i + 1;
        if (seatNum === 1) {
          newPlayers[i].team = 'red';
          newPlayers[i].isSpymaster = true;
        } else if (seatNum === 2) {
          newPlayers[i].team = 'blue';
          newPlayers[i].isSpymaster = true;
        } else if (seatNum === 3) {
          newPlayers[i].team = 'red';
          newPlayers[i].isSpymaster = false;
        } else if (seatNum === 4) {
          newPlayers[i].team = 'blue';
          newPlayers[i].isSpymaster = false;
        } else {
          // 5-8人，轮流分配队伍
          const teamIndex = (seatNum - 1) % 2;
          newPlayers[i].team = teamIndex === 0 ? 'red' : 'blue';
          newPlayers[i].isSpymaster = false;
        }
      }
      break;
  }
  
  return newPlayers;
}

// 给出线索
export function giveClue(state: GameState, team: Team, word: string, number: number): GameState {
  if (state.phase !== 'playing') {
    throw new Error('游戏未开始');
  }
  
  if (state.currentTeam !== team) {
    throw new Error('不是你的回合');
  }
  
  // 新规则：只要有当前线索且游戏进行中，就可以继续猜，不限制次数
  // 只有队员主动结束或猜错时才切换回合
  
  const clue: Clue = {
    word,
    number,
    team,
    timestamp: Date.now(),
  };
  
  return {
    ...state,
    currentClue: clue,
    remainingGuesses: -1, // -1 表示无限制
    clueHistory: [...state.clueHistory, clue],
  };
}

// 猜测卡片
export function guessCard(state: GameState, player: Player, cardIndex: number): 
  { state: GameState; result: { cardType: CardType; continueTurn: boolean; gameEnded: boolean; winner: Team | null } } {
  
  if (state.phase !== 'playing') {
    throw new Error('游戏未开始');
  }
  
  if (!player.team) {
    throw new Error('你没有队伍');
  }
  
  if (state.currentTeam !== player.team) {
    throw new Error('不是你的回合');
  }
  
  if (cardIndex < 0 || cardIndex >= state.cards.length) {
    throw new Error('无效的卡片');
  }
  
  const card = state.cards[cardIndex];
  if (card.revealed) {
    throw new Error('这张卡已经被翻开了');
  }
  
  // 新规则：没有猜测次数限制
  
  // 翻开卡片
  const newCards = [...state.cards];
  newCards[cardIndex] = { ...card, revealed: true };
  
  // 记录猜测
  const guessRecord: GuessRecord = {
    playerId: player.id,
    playerName: player.name,
    cardIndex,
    cardWord: card.word,
    cardType: card.type,
    timestamp: Date.now(),
    team: player.team,
  };
  
  let newState: GameState = {
    ...state,
    cards: newCards,
    guessHistory: [...state.guessHistory, guessRecord],
    // 保持无限制状态
    remainingGuesses: -1,
  };
  
  let continueTurn = false;
  let gameEnded = false;
  let winner: Team | null = null;
  
  // 处理结果
  switch (card.type) {
    case 'black':
      // 猜中黑牌，当前队伍直接输
      gameEnded = true;
      winner = player.team === 'red' ? 'blue' : 'red';
      newState = {
        ...newState,
        phase: 'ended',
        winner,
        endedAt: Date.now(),
      };
      break;
      
    case 'red':
      newState.redScore++;
      if (player.team === 'red') {
        // 猜对本队词，继续猜
        continueTurn = true;
        // 检查红队是否获胜
        if (newState.redScore >= newState.redTotal) {
          gameEnded = true;
          winner = 'red';
          newState = {
            ...newState,
            phase: 'ended',
            winner,
            endedAt: Date.now(),
          };
        }
      } else {
        // 猜错对方词，回合结束
        continueTurn = false;
        newState.currentTeam = 'blue';
        newState.currentClue = null;
        newState.remainingGuesses = 0;
        // 检查红队是否因此获胜（红队已经猜完）
        if (newState.redScore >= newState.redTotal) {
          gameEnded = true;
          winner = 'red';
          newState = {
            ...newState,
            phase: 'ended',
            winner,
            endedAt: Date.now(),
          };
        }
      }
      break;
      
    case 'blue':
      newState.blueScore++;
      if (player.team === 'blue') {
        // 猜对本队词，继续猜
        continueTurn = true;
        // 检查蓝队是否获胜
        if (newState.blueScore >= newState.blueTotal) {
          gameEnded = true;
          winner = 'blue';
          newState = {
            ...newState,
            phase: 'ended',
            winner,
            endedAt: Date.now(),
          };
        }
      } else {
        // 猜错对方词，回合结束
        continueTurn = false;
        newState.currentTeam = 'red';
        newState.currentClue = null;
        newState.remainingGuesses = 0;
        // 检查蓝队是否因此获胜
        if (newState.blueScore >= newState.blueTotal) {
          gameEnded = true;
          winner = 'blue';
          newState = {
            ...newState,
            phase: 'ended',
            winner,
            endedAt: Date.now(),
          };
        }
      }
      break;
      
    case 'white':
      // 猜中白牌，回合结束
      continueTurn = false;
      newState.currentTeam = player.team === 'red' ? 'blue' : 'red';
      newState.currentClue = null;
      newState.remainingGuesses = 0;
      break;
  }
  
  return {
    state: newState,
    result: {
      cardType: card.type,
      continueTurn,
      gameEnded,
      winner,
    },
  };
}

// 结束回合
export function endTurn(state: GameState, team: Team): GameState {
  if (state.phase !== 'playing') {
    throw new Error('游戏未开始');
  }
  
  if (state.currentTeam !== team) {
    throw new Error('不是你的回合');
  }
  
  return {
    ...state,
    currentTeam: team === 'red' ? 'blue' : 'red',
    currentClue: null,
    remainingGuesses: 0,
  };
}

// 重新开始游戏
export function restartGame(state: GameState): GameState {
  return startGame({
    ...state,
    phase: 'waiting',
    cards: [],
    currentTeam: 'red',
    currentClue: null,
    redScore: 0,
    blueScore: 0,
    winner: null,
    remainingGuesses: 0,
    guessHistory: [],
    clueHistory: [],
    startedAt: null,
    endedAt: null,
  });
}

// 获取公开的卡片信息（根据玩家角色）
export function getPublicCards(state: GameState, player: Player | null): Card[] {
  if (!player || !player.team || player.isSpymaster) {
    // 观战者或队长可以看到所有卡片颜色
    return state.cards;
  }
  
  // 队员只能看到已翻开的卡片颜色，未翻开的显示为null
  return state.cards.map(card => ({
    ...card,
    type: card.revealed ? card.type : ('hidden' as CardType),
  }));
}
