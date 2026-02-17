// 前端类型定义（与后端保持一致）

export type Team = 'red' | 'blue';
export type CardType = 'red' | 'blue' | 'white' | 'black' | 'hidden';
export type GamePhase = 'waiting' | 'playing' | 'ended';

export interface Card {
  id: number;
  word: string;
  type: CardType;
  revealed: boolean;
}

export interface Player {
  id: string;
  clientId: string;
  name: string;
  socketId: string;
  seatIndex: number | null;
  isHost: boolean;
  team?: Team;
  isSpymaster: boolean;
  isDoubleAgent?: boolean;
  isOnline: boolean;
}

export interface Clue {
  word: string;
  number: number;
  team: Team;
  timestamp: number;
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

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  cards: Card[];
  currentTeam: Team;
  currentClue: Clue | null;
  redScore: number;
  blueScore: number;
  redTotal: number;
  blueTotal: number;
  winner: Team | null;
  maxPlayers: number;
  remainingGuesses: number;
  guessHistory: GuessRecord[];
  clueHistory: Clue[];
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}

export interface RoomConfig {
  maxPlayers: number;
  allowWhiteContinue: boolean;
  timeLimit: number | null;
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

// 用户信息
export interface UserInfo {
  id: string;
  name: string;
  roomId: string | null;
}
