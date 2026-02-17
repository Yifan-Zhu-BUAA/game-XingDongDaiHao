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
  let firstTeam: Team = redCount > blueCount ? 'red' : 'blue';
  
  // 2人模式：两人都在红队，必须红队先手
  if (state.maxPlayers === 2) {
    firstTeam = 'red';
  }
  
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
  
  switch (maxPlayers) {
    case 2:
      // 2人模式：玩家1红队长，玩家2红队员
      // 蓝队无人 → 每回合自动翻一张蓝牌形成时间压力
      newPlayers[0].team = 'red';
      newPlayers[0].isSpymaster = true;
      newPlayers[0].isDoubleAgent = false;
      newPlayers[1].team = 'red';
      newPlayers[1].isSpymaster = false;
      newPlayers[1].isDoubleAgent = false;
      break;
      
    case 3:
      // 3人模式：玩家1红队长，玩家2蓝队长，玩家3双面间谍（两队回合都可猜）
      newPlayers[0].team = 'red';
      newPlayers[0].isSpymaster = true;
      newPlayers[0].isDoubleAgent = false;
      newPlayers[1].team = 'blue';
      newPlayers[1].isSpymaster = true;
      newPlayers[1].isDoubleAgent = false;
      newPlayers[2].team = 'red';
      newPlayers[2].isSpymaster = false;
      newPlayers[2].isDoubleAgent = true; // 双面间谍：红蓝回合都可猜牌
      break;
      
    case 4:
    default:
      // 4人及以上标准模式
      for (let i = 0; i < newPlayers.length; i++) {
        const seatNum = i + 1;
        newPlayers[i].isDoubleAgent = false;
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
          const teamIndex = (seatNum - 1) % 2;
          newPlayers[i].team = teamIndex === 0 ? 'red' : 'blue';
          newPlayers[i].isSpymaster = false;
        }
      }
      break;
  }
  
  return newPlayers;
}

// 回合切换（处理2人模式自动翻牌）
function performTurnSwitch(state: GameState): GameState {
  const nextTeam: Team = state.currentTeam === 'red' ? 'blue' : 'red';
  
  // 检查对方队伍是否有猜牌人（非队长的队员，或双面间谍）
  const hasNextTeamGuesser = state.players.some(
    p => p.seatIndex !== null && !p.isSpymaster && (p.team === nextTeam || p.isDoubleAgent)
  );
  
  if (hasNextTeamGuesser) {
    // 正常切换回合
    return {
      ...state,
      currentTeam: nextTeam,
      currentClue: null,
      remainingGuesses: 0,
    };
  }
  
  // 2人模式：对方无人猜牌，自动翻一张对方颜色的牌，保持当前队伍
  const newCards = [...state.cards];
  const candidates = newCards.filter(c => !c.revealed && c.type === nextTeam);
  
  let updatedState: GameState = {
    ...state,
    currentClue: null,
    remainingGuesses: 0,
  };
  
  if (candidates.length > 0) {
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    newCards[pick.id] = { ...pick, revealed: true };
    updatedState.cards = newCards;
    
    if (nextTeam === 'red') updatedState.redScore++;
    else updatedState.blueScore++;
    
    // 自动翻牌可能导致对方获胜
    const score = nextTeam === 'red' ? updatedState.redScore : updatedState.blueScore;
    const total = nextTeam === 'red' ? updatedState.redTotal : updatedState.blueTotal;
    if (score >= total) {
      return {
        ...updatedState,
        phase: 'ended',
        winner: nextTeam,
        endedAt: Date.now(),
      };
    }
  }
  
  // 保持当前队伍回合（红队继续）
  return updatedState;
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
  
  // 双面间谍在两队回合都可猜牌，以当前队伍身份行动
  const effectiveTeam: Team = player.isDoubleAgent ? state.currentTeam : player.team;
  
  if (state.currentTeam !== effectiveTeam) {
    throw new Error('不是你的回合');
  }
  
  if (cardIndex < 0 || cardIndex >= state.cards.length) {
    throw new Error('无效的卡片');
  }
  
  const card = state.cards[cardIndex];
  if (card.revealed) {
    throw new Error('这张卡已经被翻开了');
  }
  
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
    team: effectiveTeam,
  };
  
  let newState: GameState = {
    ...state,
    cards: newCards,
    guessHistory: [...state.guessHistory, guessRecord],
    remainingGuesses: -1,
  };
  
  let continueTurn = false;
  let gameEnded = false;
  let winner: Team | null = null;
  
  switch (card.type) {
    case 'black':
      // 猜中黑牌，当前队伍直接输
      gameEnded = true;
      winner = effectiveTeam === 'red' ? 'blue' : 'red';
      newState = { ...newState, phase: 'ended', winner, endedAt: Date.now() };
      break;
      
    case 'red':
      newState.redScore++;
      if (newState.redScore >= newState.redTotal) {
        gameEnded = true;
        winner = 'red';
        newState = { ...newState, phase: 'ended', winner, endedAt: Date.now() };
      } else if (effectiveTeam === 'red') {
        continueTurn = true;
      } else {
        // 猜错对方词，切换回合
        newState = performTurnSwitch(newState);
        if (newState.phase === 'ended') { gameEnded = true; winner = newState.winner; }
      }
      break;
      
    case 'blue':
      newState.blueScore++;
      if (newState.blueScore >= newState.blueTotal) {
        gameEnded = true;
        winner = 'blue';
        newState = { ...newState, phase: 'ended', winner, endedAt: Date.now() };
      } else if (effectiveTeam === 'blue') {
        continueTurn = true;
      } else {
        // 猜错对方词，切换回合
        newState = performTurnSwitch(newState);
        if (newState.phase === 'ended') { gameEnded = true; winner = newState.winner; }
      }
      break;
      
    case 'white':
      // 猜中白牌，切换回合
      newState = performTurnSwitch(newState);
      if (newState.phase === 'ended') { gameEnded = true; winner = newState.winner; }
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
  
  return performTurnSwitch(state);
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
