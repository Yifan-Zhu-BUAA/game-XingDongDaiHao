// 游戏类型定义

export type Team = 'red' | 'blue';
export type CardType = 'red' | 'blue' | 'white' | 'black';
export type GamePhase = 'waiting' | 'playing' | 'ended';

export interface Card {
  id: number;
  word: string;
  type: CardType;
  revealed: boolean;
}

export interface Player {
  id: string;
  clientId: string; // 客户端唯一标识（持久化在浏览器中）
  name: string;
  socketId: string;
  seatIndex: number | null; // null = 观战
  isHost: boolean;
  team?: Team;
  isSpymaster: boolean;
  isDoubleAgent?: boolean; // 双面间谍（3人模式）
  isOnline: boolean; // 是否在线
}

export interface Clue {
  word: string;
  number: number;
  team: Team;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  cards: Card[];
  currentTeam: Team;
  currentClue: Clue | null;
  redScore: number;
  blueScore: number;
  redTotal: number; // 红队总词数
  blueTotal: number; // 蓝队总词数
  winner: Team | null;
  maxPlayers: number;
  remainingGuesses: number; // 剩余可猜次数
  guessHistory: GuessRecord[];
  clueHistory: Clue[];
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  customWords: string[] | null; // 自定义词汇
  wordTheme: string | null; // 词汇主题描述
}

export interface GuessRecord {
  playerId: string;
  playerName: string;
  cardIndex: number;
  cardWord: string;
  cardType: CardType;
  timestamp: number;
  team: Team;
}

// 房间配置
export interface RoomConfig {
  maxPlayers: number;
  allowWhiteContinue: boolean; // 猜到白牌是否继续
  timeLimit: number | null; // 每回合时间限制（秒），null为无限制
}

// WebSocket 事件类型
export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:error': (message: string) => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'room:chat': (message: ChatMessage) => void;
  'clue:new': (clue: Clue) => void;
  'guess:result': (result: GuessResult) => void;
  'game:ended': (winner: Team, reason: string) => void;
}

export interface ClientToServerEvents {
  'room:join': (roomId: string, playerName: string, callback: (success: boolean, error?: string) => void) => void;
  'room:leave': () => void;
  'seat:take': (seatIndex: number, callback: (success: boolean, error?: string) => void) => void;
  'seat:leave': () => void;
  'seat:switch': (targetSeatIndex: number, callback: (success: boolean, error?: string) => void) => void;
  'game:start': (callback: (success: boolean, error?: string) => void) => void;
  'game:restart': (callback: (success: boolean, error?: string) => void) => void;
  'clue:give': (word: string, number: number, callback: (success: boolean, error?: string) => void) => void;
  'card:guess': (cardIndex: number, callback: (success: boolean, error?: string) => void) => void;
  'turn:end': (callback: (success: boolean, error?: string) => void) => void;
  'chat:send': (message: string) => void;
  'config:update': (config: Partial<RoomConfig>, callback: (success: boolean, error?: string) => void) => void;
  'player:rename': (newName: string, callback: (success: boolean, error?: string) => void) => void;
  'words:set': (words: string[] | null, theme: string | null, callback: (success: boolean, error?: string) => void) => void;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  isSystem: boolean;
}

export interface GuessResult {
  success: boolean;
  cardType: CardType;
  cardWord: string;
  continueTurn: boolean;
  gameEnded: boolean;
  winner: Team | null;
}
