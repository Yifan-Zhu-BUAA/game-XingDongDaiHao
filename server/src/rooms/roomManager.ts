import { GameState, Player, Team, RoomConfig, ChatMessage } from '../game/types.js';
import { createGameState, startGame, giveClue, guessCard, endTurn, restartGame, generateRoomId, generateId } from '../game/gameLogic.js';

// 内存中的房间存储
const rooms: Map<string, GameState> = new Map();
const playerToRoom: Map<string, string> = new Map(); // socketId -> roomId
const clientToRoom: Map<string, string> = new Map(); // clientId -> roomId

// 房间最大存活时间（12小时）
const ROOM_MAX_LIFETIME = 12 * 60 * 60 * 1000;

// 定期清理过期房间（每10分钟检查一次）
setInterval(() => {
  cleanupExpiredRooms();
}, 10 * 60 * 1000);

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
      clientToRoom.delete(player.clientId);
    });
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  }
}

// 通过 clientId 查找玩家所在房间
export function findPlayerByClientId(clientId: string): { roomId: string; player: Player; state: GameState } | null {
  const roomId = clientToRoom.get(clientId);
  if (!roomId) return null;
  
  const room = rooms.get(roomId);
  if (!room) {
    clientToRoom.delete(clientId);
    return null;
  }
  
  const player = room.players.find(p => p.clientId === clientId);
  if (!player) {
    clientToRoom.delete(clientId);
    return null;
  }
  
  return { roomId, player, state: room };
}

// 玩家重连（通过 clientId）
export function reconnectPlayer(clientId: string, socketId: string): 
  { success: boolean; roomId?: string; player?: Player; state?: GameState } {
  
  const found = findPlayerByClientId(clientId);
  if (!found) {
    return { success: false };
  }
  
  const { roomId, player, state } = found;
  
  console.log(`Player ${player.name} reconnecting to room ${roomId} via clientId`);
  
  // 清除旧的 socketId 映射
  playerToRoom.delete(player.socketId);
  
  // 更新 socketId 和在线状态
  player.socketId = socketId;
  player.isOnline = true;
  playerToRoom.set(socketId, roomId);
  
  return { success: true, roomId, player, state };
}

// 玩家加入房间（全新加入）
export function joinRoom(roomId: string, socketId: string, playerName: string, clientId: string): 
  { success: boolean; player?: Player; error?: string; state?: GameState } {
  
  const room = getOrCreateRoom(roomId);
  
  // 检查是否有同 clientId 的玩家已在房间（不应该走到这里，但防御性检查）
  const existingByClientId = room.players.find(p => p.clientId === clientId);
  if (existingByClientId) {
    // 直接恢复
    playerToRoom.delete(existingByClientId.socketId);
    existingByClientId.socketId = socketId;
    existingByClientId.isOnline = true;
    existingByClientId.name = playerName; // 允许更新昵称
    playerToRoom.set(socketId, roomId);
    return { success: true, player: existingByClientId, state: room };
  }
  
  // 检查是否已有同名在线玩家
  const existingByName = room.players.find(p => p.name === playerName && p.isOnline);
  if (existingByName) {
    return { success: false, error: '该昵称已被使用' };
  }
  
  // 全新玩家加入
  const player: Player = {
    id: generateId(),
    clientId,
    name: playerName,
    socketId,
    seatIndex: null,
    isHost: room.players.length === 0,
    isSpymaster: false,
    isOnline: true,
  };
  
  room.players.push(player);
  playerToRoom.set(socketId, roomId);
  clientToRoom.set(clientId, roomId);
  
  return { success: true, player, state: room };
}

// 玩家修改昵称
export function renamePlayer(roomId: string, socketId: string, newName: string): 
  { success: boolean; error?: string; oldName?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) return { success: false, error: '房间不存在' };
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) return { success: false, error: '玩家不存在' };
  
  // 校验昵称长度
  const trimmed = newName.trim();
  if (!trimmed || trimmed.length > 4) {
    return { success: false, error: '昵称需为1-4个字符' };
  }
  
  // 检查是否有同名在线玩家（排除自己）
  const duplicate = room.players.find(p => p.name === trimmed && p.socketId !== socketId && p.isOnline);
  if (duplicate) {
    return { success: false, error: '该昵称已被使用' };
  }
  
  const oldName = player.name;
  player.name = trimmed;
  
  return { success: true, oldName, state: room };
}

// 玩家断线（仅标记离线，不移除，房间存在期间随时可重连）
export function playerDisconnect(socketId: string): { roomId?: string; playerId?: string; state?: GameState } {
  const roomId = playerToRoom.get(socketId);
  if (!roomId) {
    return {};
  }
  
  const room = rooms.get(roomId);
  if (!room) {
    playerToRoom.delete(socketId);
    return {};
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player) {
    playerToRoom.delete(socketId);
    return {};
  }
  
  // 标记为离线（不移除，随时可重连）
  player.isOnline = false;
  playerToRoom.delete(socketId);
  console.log(`Player ${player.name} marked offline in room ${roomId}`);
  
  return { roomId, playerId: player.id, state: room };
}

// 玩家主动离开房间（清除身份，不可重连）
export function leaveRoom(socketId: string, clientId?: string): { roomId?: string; playerId?: string; state?: GameState; deleted?: boolean } {
  const roomId = playerToRoom.get(socketId);
  if (!roomId) {
    return {};
  }
  
  const room = rooms.get(roomId);
  if (!room) {
    playerToRoom.delete(socketId);
    if (clientId) clientToRoom.delete(clientId);
    return {};
  }
  
  const playerIndex = room.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) {
    playerToRoom.delete(socketId);
    if (clientId) clientToRoom.delete(clientId);
    return {};
  }
  
  const player = room.players[playerIndex];
  
  // 移除玩家
  room.players.splice(playerIndex, 1);
  playerToRoom.delete(socketId);
  clientToRoom.delete(player.clientId);
  
  // 如果房主离开，转移房主
  if (player.isHost && room.players.length > 0) {
    const onlinePlayer = room.players.find(p => p.isOnline);
    if (onlinePlayer) {
      onlinePlayer.isHost = true;
    } else {
      room.players[0].isHost = true;
    }
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

// 设置自定义词汇
export function setRoomCustomWords(roomId: string, socketId: string, words: string[] | null, theme?: string | null):
  { success: boolean; error?: string; state?: GameState } {
  
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }
  
  const player = room.players.find(p => p.socketId === socketId);
  if (!player || !player.isHost) {
    return { success: false, error: '只有房主可以设置词汇' };
  }
  
  if (room.phase !== 'waiting') {
    return { success: false, error: '游戏已开始' };
  }
  
  room.customWords = words;
  room.wordTheme = theme || null;
  
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
    const newState = startGame(room, room.customWords);
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
  
  // 双面间谍在任意队伍回合都可结束
  const effectiveTeam = player.isDoubleAgent ? room.currentTeam : player.team;
  if (!effectiveTeam) {
    return { success: false, error: '你不是游戏玩家' };
  }
  
  try {
    const newState = endTurn(room, effectiveTeam);
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

// 清理过期房间（12小时自动过期）
export function cleanupExpiredRooms(): void {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_MAX_LIFETIME) {
      console.log(`Room ${roomId} expired after 12 hours, deleting`);
      deleteRoom(roomId);
    }
  }
}
