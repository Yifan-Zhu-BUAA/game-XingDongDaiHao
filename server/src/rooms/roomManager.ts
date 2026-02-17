import { GameState, Player, Team, RoomConfig, ChatMessage } from '../game/types.js';
import { createGameState, startGame, giveClue, guessCard, endTurn, restartGame, generateRoomId, generateId } from '../game/gameLogic.js';

// 内存中的房间存储
const rooms: Map<string, GameState> = new Map();
const playerToRoom: Map<string, string> = new Map(); // socketId -> roomId

// 获取或创建房间
export function getOrCreateRoom(roomId: string): GameState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createGameState(roomId));
  }
  return rooms.get(roomId)!;
}

// 获取房间
export function getRoom(roomId: string): GameState | undefined {
  return rooms.get(roomId);
}

// 删除房间
export function deleteRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    // 清理玩家映射
    room.players.forEach(player => {
      playerToRoom.delete(player.socketId);
    });
    rooms.delete(roomId);
  }
}

// 玩家加入房间
export function joinRoom(roomId: string, socketId: string, playerName: string): 
  { success: boolean; player?: Player; error?: string; state?: GameState } {
  
  const room = getOrCreateRoom(roomId);
  
  // 检查游戏是否已开始
  if (room.phase !== 'waiting') {
    // 游戏已开始，作为观战者加入
    const player: Player = {
      id: generateId(),
      name: playerName,
      socketId,
      seatIndex: null,
      isHost: false,
    };
    
    room.players.push(player);
    playerToRoom.set(socketId, roomId);
    
    return { success: true, player, state: room };
  }
  
  // 检查是否已有同名玩家
  const existingPlayer = room.players.find(p => p.name === playerName);
  if (existingPlayer) {
    return { success: false, error: '该昵称已被使用' };
  }
  
  // 创建新玩家
  const player: Player = {
    id: generateId(),
    name: playerName,
    socketId,
    seatIndex: null,
    isHost: room.players.length === 0, // 第一个玩家成为房主
  };
  
  room.players.push(player);
  playerToRoom.set(socketId, roomId);
  
  return { success: true, player, state: room };
}

// 玩家离开房间
export function leaveRoom(socketId: string): { roomId?: string; playerId?: string; state?: GameState; deleted?: boolean } {
  const roomId = playerToRoom.get(socketId);
  if (!roomId) {
    return {};
  }
  
  const room = rooms.get(roomId);
  if (!room) {
    playerToRoom.delete(socketId);
    return {};
  }
  
  const playerIndex = room.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) {
    playerToRoom.delete(socketId);
    return {};
  }
  
  const player = room.players[playerIndex];
  
  // 如果玩家在游戏座位上，重置座位
  if (player.seatIndex !== null && room.phase === 'waiting') {
    // 只有等待阶段才释放座位
  }
  
  // 移除玩家
  room.players.splice(playerIndex, 1);
  playerToRoom.delete(socketId);
  
  // 如果房主离开，转移房主
  if (player.isHost && room.players.length > 0) {
    room.players[0].isHost = true;
  }
  
  // 如果房间空了，删除房间
  if (room.players.length === 0) {
    deleteRoom(roomId);
    return { roomId, playerId: player.id, deleted: true };
  }
  
  return { roomId, playerId: player.id, state: room };
}

// 玩家入座
export function takeSeat(roomId: string, socketId: string, seatIndex: number): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  if (room.phase !== 'waiting') {
    return { success: false, error: '游戏已开始' };
  }
  
  if (seatIndex < 0 || seatIndex >= room.maxPlayers) {
    return { success: false, error: '无效的座位' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) {
    return { success: false, error: '玩家不在房间中' };
  }
  
  // 检查座位是否被占用
  const occupiedPlayer = room.players.find(p => p.seatIndex === seatIndex);
  if (occupiedPlayer) {
    return { success: false, error: '该座位已被占用' };
  }
  
  // 离开当前座位
  if (player.seatIndex !== null) {
    player.seatIndex = null;
  }
  
  // 入座
  player.seatIndex = seatIndex;
  
  return { success: true, state: room };
}

// 玩家离座
export function leaveSeat(roomId: string, socketId: string): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  if (room.phase !== 'waiting') {
    return { success: false, error: '游戏已开始' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) {
    return { success: false, error: '玩家不在房间中' };
  }
  
  player.seatIndex = null;
  
  return { success: true, state: room };
}

// 换座位
export function switchSeat(roomId: string, socketId: string, targetSeatIndex: number): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  if (room.phase !== 'waiting') {
    return { success: false, error: '游戏已开始' };
  }
  
  if (targetSeatIndex < 0 || targetSeatIndex >= room.maxPlayers) {
    return { success: false, error: '无效的座位' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) {
    return { success: false, error: '玩家不在房间中' };
  }
  
  if (player.seatIndex === null) {
    return { success: false, error: '你不在座位上' };
  }
  
  // 检查目标座位是否被占用
  const targetPlayer = room.players.find(p => p.seatIndex === targetSeatIndex);
  if (targetPlayer) {
    // 交换座位
    targetPlayer.seatIndex = player.seatIndex;
    player.seatIndex = targetSeatIndex;
  } else {
    // 直接换座
    player.seatIndex = targetSeatIndex;
  }
  
  return { success: true, state: room };
}

// 修改最大人数
export function updateMaxPlayers(roomId: string, socketId: string, maxPlayers: number): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player || !player.isHost) {
    return { success: false, error: '只有房主可以修改人数' };
  }
  
  if (room.phase !== 'waiting') {
    return { success: false, error: '游戏已开始' };
  }
  
  if (maxPlayers < 2 || maxPlayers > 8) {
    return { success: false, error: '人数必须在2-8之间' };
  }
  
  // 检查当前入座人数
  const seatedCount = room.players.filter(p => p.seatIndex !== null).length;
  if (seatedCount > maxPlayers) {
    return { success: false, error: '当前入座人数超过新的人数限制' };
  }
  
  room.maxPlayers = maxPlayers;
  
  return { success: true, state: room };
}

// 开始游戏
export function startGameByHost(roomId: string, socketId: string): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player || !player.isHost) {
    return { success: false, error: '只有房主可以开始游戏' };
  }
  
  if (room.phase !== 'waiting') {
    return { success: false, error: '游戏已经开始' };
  }
  
  const seatedPlayers = room.players.filter(p => p.seatIndex !== null);
  if (seatedPlayers.length < 2) {
    return { success: false, error: '至少需要2名玩家入座' };
  }
  
  try {
    const newState = startGame(room);
    rooms.set(roomId, newState);
    return { success: true, state: newState };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// 给出线索
export function giveClueByPlayer(roomId: string, socketId: string, word: string, number: number): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player || !player.team) {
    return { success: false, error: '你不是游戏玩家' };
  }
  
  if (!player.isSpymaster) {
    return { success: false, error: '只有队长可以给出线索' };
  }
  
  try {
    const newState = giveClue(room, player.team, word, number);
    rooms.set(roomId, newState);
    return { success: true, state: newState };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// 猜测卡片
export function guessCardByPlayer(roomId: string, socketId: string, cardIndex: number): 
  { success: boolean; error?: string; state?: GameState; result?: { cardType: string; continueTurn: boolean; gameEnded: boolean; winner: Team | null } } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) {
    return { success: false, error: '玩家不在房间中' };
  }
  
  try {
    const { state: newState, result } = guessCard(room, player, cardIndex);
    rooms.set(roomId, newState);
    return { success: true, state: newState, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// 结束回合
export function endTurnByPlayer(roomId: string, socketId: string): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player || !player.team) {
    return { success: false, error: '你不是游戏玩家' };
  }
  
  try {
    const newState = endTurn(room, player.team);
    rooms.set(roomId, newState);
    return { success: true, state: newState };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// 重新开始游戏
export function restartGameByHost(roomId: string, socketId: string): 
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player || !player.isHost) {
    return { success: false, error: '只有房主可以重新开始' };
  }
  
  if (room.phase !== 'ended') {
    return { success: false, error: '游戏尚未结束' };
  }
  
  try {
    const newState = restartGame(room);
    rooms.set(roomId, newState);
    return { success: true, state: newState };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// 获取玩家所在房间
export function getPlayerRoom(socketId: string): string | undefined {
  return playerToRoom.get(socketId);
}

// 获取房间中的所有玩家socketId
export function getRoomPlayerSockets(roomId: string): string[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return room.players.map(p => p.socketId);
}

// 清理空闲房间（可以定时调用）
export function cleanupIdleRooms(maxIdleTime: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    // 如果房间已结束或创建时间超过最大空闲时间
    if (room.phase === 'ended' || now - room.createdAt > maxIdleTime) {
      deleteRoom(roomId);
    }
  }
}
