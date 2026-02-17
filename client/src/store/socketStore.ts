/// <reference types="vite/client" />
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, Player, Clue, GuessResult, Team, ChatMessage } from '../types';

// Socket.io 事件类型
interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:error': (message: string) => void;
  'player:joined': (player: Player) => void;
  'player:left': (playerId: string) => void;
  'room:chat': (message: ChatMessage) => void;
  'clue:new': (clue: Clue) => void;
  'guess:result': (result: GuessResult) => void;
  'game:ended': (winner: Team, reason: string) => void;
}

interface ClientToServerEvents {
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
  'config:update': (config: { maxPlayers?: number }, callback: (success: boolean, error?: string) => void) => void;
}

interface SocketStore {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  gameState: GameState | null;
  playerId: string | null;
  playerName: string | null;
  roomId: string | null;
  error: string | null;
  lastGuessResult: GuessResult | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  joinRoom: (roomId: string, playerName: string) => Promise<boolean>;
  leaveRoom: () => void;
  takeSeat: (seatIndex: number) => Promise<boolean>;
  leaveSeat: () => void;
  switchSeat: (targetSeatIndex: number) => Promise<boolean>;
  startGame: () => Promise<boolean>;
  restartGame: () => Promise<boolean>;
  giveClue: (word: string, number: number) => Promise<boolean>;
  guessCard: (cardIndex: number) => Promise<boolean>;
  endTurn: () => Promise<boolean>;
  updateMaxPlayers: (maxPlayers: number) => Promise<boolean>;
  clearError: () => void;
}

// 服务器地址
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3000');

// localStorage key常量
const LS_PLAYER_NAME = 'codenames_playerName';
const LS_ROOM_ID = 'codenames_roomId';
const LS_CLIENT_ID = 'codenames_clientId';

// 获取或生成 clientId
function getClientId(): string {
  let clientId = localStorage.getItem(LS_CLIENT_ID);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(LS_CLIENT_ID, clientId);
  }
  return clientId;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  isConnected: false,
  gameState: null,
  playerId: null,
  playerName: localStorage.getItem(LS_PLAYER_NAME) || null,
  roomId: localStorage.getItem(LS_ROOM_ID) || null,
  error: null,
  lastGuessResult: null,

  connect: () => {
    const clientId = getClientId();

    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: { clientId },
    });

    socket.on('connect', () => {
      console.log('Connected to server, clientId:', clientId);
      set({ isConnected: true, error: null });
    });

    // 服务端自动重连成功通知
    (socket as any).on('reconnected', (data: { roomId: string; playerName: string }) => {
      console.log('Auto-reconnected to room:', data.roomId, 'as:', data.playerName);
      set({ roomId: data.roomId, playerName: data.playerName });
      localStorage.setItem(LS_ROOM_ID, data.roomId);
      localStorage.setItem(LS_PLAYER_NAME, data.playerName);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      set({ isConnected: false });
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      set({ error: '连接服务器失败，请检查网络' });
    });

    socket.on('game:state', (state) => {
      console.log('Game state updated:', state);
      set({ gameState: state });
    });

    socket.on('game:error', (message) => {
      console.error('Game error:', message);
      set({ error: message });
    });

    socket.on('player:joined', (player) => {
      console.log('Player joined:', player);
    });

    socket.on('player:left', (playerId) => {
      console.log('Player left:', playerId);
    });

    socket.on('clue:new', (clue) => {
      console.log('New clue:', clue);
    });

    socket.on('guess:result', (result) => {
      console.log('Guess result:', result);
      set({ lastGuessResult: result });
      // 3秒后清除结果
      setTimeout(() => set({ lastGuessResult: null }), 3000);
    });

    socket.on('game:ended', (winner, reason) => {
      console.log('Game ended:', winner, reason);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  joinRoom: (roomId: string, playerName: string) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        set({ error: '未连接到服务器' });
        resolve(false);
        return;
      }

      socket.emit('room:join', roomId, playerName, (success, error) => {
        if (success) {
          set({ roomId, playerName, error: null });
          // 保存到 localStorage
          localStorage.setItem(LS_PLAYER_NAME, playerName);
          localStorage.setItem(LS_ROOM_ID, roomId);
        } else {
          set({ error: error || '加入房间失败' });
        }
        resolve(success);
      });
    });
  },

  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('room:leave');
      // 清除 localStorage 房间信息（保留 clientId 和 playerName）
      localStorage.removeItem(LS_ROOM_ID);
      set({ gameState: null, roomId: null, playerId: null });
    }
  },

  takeSeat: (seatIndex: number) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('seat:take', seatIndex, (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  leaveSeat: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('seat:leave');
    }
  },

  switchSeat: (targetSeatIndex: number) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('seat:switch', targetSeatIndex, (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  startGame: () => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('game:start', (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  restartGame: () => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('game:restart', (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  giveClue: (word: string, number: number) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('clue:give', word, number, (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  guessCard: (cardIndex: number) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('card:guess', cardIndex, (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  endTurn: () => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('turn:end', (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  updateMaxPlayers: (maxPlayers: number) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) {
        resolve(false);
        return;
      }

      socket.emit('config:update', { maxPlayers }, (success, error) => {
        if (!success && error) {
          set({ error });
        }
        resolve(success);
      });
    });
  },

  clearError: () => set({ error: null }),
}));
