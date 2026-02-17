import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { ClientToServerEvents, ServerToClientEvents, CardType } from './game/types.js';
import {
  joinRoom,
  leaveRoom,
  playerDisconnect,
  reconnectPlayer,
  renamePlayer,
  takeSeat,
  leaveSeat,
  switchSeat,
  updateMaxPlayers,
  startGameByHost,
  giveClueByPlayer,
  guessCardByPlayer,
  endTurnByPlayer,
  restartGameByHost,
  getRoom,
  getPlayerRoom,
  getRoomPlayerSockets,
  getOrCreateRoom,
} from './rooms/roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS配置
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? true // 生产环境允许所有来源（因为前端后端同域）
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], // 开发环境
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// 健康检查接口（必须在静态文件中间件之前）
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 获取房间信息接口（必须在静态文件中间件之前）
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  
  if (!room) {
    res.status(404).json({ error: '房间不存在' });
    return;
  }
  
  // 只返回公开信息
  res.json({
    roomId: room.roomId,
    phase: room.phase,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
  });
});

// Socket.io配置
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

// 生产环境提供静态文件
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  
  // SPA回退：非API路径都返回index.html
  app.get(/^(?!\/api\/).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Socket.io连接处理
io.on('connection', (socket) => {
  const clientId = socket.handshake.auth?.clientId as string;
  console.log('Player connected:', socket.id, 'clientId:', clientId);

  // 自动重连：如果 clientId 对应有离线玩家，自动恢复
  if (clientId) {
    const reconnResult = reconnectPlayer(clientId, socket.id);
    if (reconnResult.success && reconnResult.roomId && reconnResult.state) {
      socket.join(reconnResult.roomId);
      // 发送当前游戏状态给重连的玩家
      socket.emit('game:state', reconnResult.state);
      // 通知房间内其他玩家状态更新（玩家上线了）
      socket.to(reconnResult.roomId).emit('game:state', reconnResult.state);
      // 通知客户端重连信息
      socket.emit('reconnected' as any, {
        roomId: reconnResult.roomId,
        playerName: reconnResult.player!.name,
      });
      console.log(`Player ${reconnResult.player!.name} auto-reconnected to room ${reconnResult.roomId}`);
    }
  }

  // 加入房间
  socket.on('room:join', (roomId, playerName, callback) => {
    const { success, player, error, state } = joinRoom(roomId, socket.id, playerName, clientId);
    
    if (success && player && state) {
      socket.join(roomId);
      
      // 通知其他玩家
      socket.to(roomId).emit('player:joined', player);
      io.to(roomId).emit('game:state', state);
      
      console.log(`Player ${playerName} joined room ${roomId}`);
    }
    
    callback(success, error);
  });

  // 离开房间
  socket.on('room:leave', () => {
    const result = leaveRoom(socket.id);
    
    if (result.roomId && result.playerId) {
      socket.leave(result.roomId);
      
      if (!result.deleted && result.state) {
        // 通知其他玩家
        socket.to(result.roomId).emit('player:left', result.playerId);
        socket.to(result.roomId).emit('game:state', result.state);
      }
      
      console.log(`Player ${result.playerId} left room ${result.roomId}`);
    }
  });

  // 入座
  socket.on('seat:take', (seatIndex, callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const { success, error, state } = takeSeat(roomId, socket.id, seatIndex);
    
    if (success && state) {
      io.to(roomId).emit('game:state', state);
    }
    
    callback(success, error);
  });

  // 离座
  socket.on('seat:leave', () => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) return;
    
    const { success, state } = leaveSeat(roomId, socket.id);
    
    if (success && state) {
      io.to(roomId).emit('game:state', state);
    }
  });

  // 换座位
  socket.on('seat:switch', (targetSeatIndex, callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const { success, error, state } = switchSeat(roomId, socket.id, targetSeatIndex);
    
    if (success && state) {
      io.to(roomId).emit('game:state', state);
    }
    
    callback(success, error);
  });

  // 修改昵称
  socket.on('player:rename', (newName: string, callback: (success: boolean, error?: string) => void) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const result = renamePlayer(roomId, socket.id, newName);
    
    if (result.success && result.state) {
      io.to(roomId).emit('game:state', result.state);
    }
    
    callback(result.success, result.error);
  });

  // 修改人数
  socket.on('config:update', (config, callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    if (config.maxPlayers) {
      const { success, error, state } = updateMaxPlayers(roomId, socket.id, config.maxPlayers);
      
      if (success && state) {
        io.to(roomId).emit('game:state', state);
      }
      
      callback(success, error);
    } else {
      callback(true);
    }
  });

  // 开始游戏
  socket.on('game:start', (callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const { success, error, state } = startGameByHost(roomId, socket.id);
    
    if (success && state) {
      io.to(roomId).emit('game:state', state);
      console.log(`Game started in room ${roomId}`);
    }
    
    callback(success, error);
  });

  // 给出线索
  socket.on('clue:give', (word, number, callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const { success, error, state } = giveClueByPlayer(roomId, socket.id, word, number);
    
    if (success && state) {
      io.to(roomId).emit('game:state', state);
      if (state.currentClue) {
        io.to(roomId).emit('clue:new', state.currentClue);
      }
    }
    
    callback(success, error);
  });

  // 猜测卡片
  socket.on('card:guess', (cardIndex, callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const { success, error, state, result } = guessCardByPlayer(roomId, socket.id, cardIndex);
    
    if (success && state && result) {
      io.to(roomId).emit('game:state', state);
      io.to(roomId).emit('guess:result', {
        success: result.continueTurn,
        cardType: result.cardType as CardType,
        cardWord: state.cards[cardIndex].word,
        continueTurn: result.continueTurn,
        gameEnded: result.gameEnded,
        winner: result.winner,
      });
      
      if (result.gameEnded && result.winner) {
        io.to(roomId).emit('game:ended', result.winner, result.cardType === 'black' ? '猜中黑牌' : '找完所有词');
      }
    }
    
    callback(success, error);
  });

  // 结束回合
  socket.on('turn:end', (callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const { success, error, state } = endTurnByPlayer(roomId, socket.id);
    
    if (success && state) {
      io.to(roomId).emit('game:state', state);
    }
    
    callback(success, error);
  });

  // 重新开始游戏
  socket.on('game:restart', (callback) => {
    const roomId = getPlayerRoom(socket.id);
    if (!roomId) {
      callback(false, '不在房间中');
      return;
    }
    
    const { success, error, state } = restartGameByHost(roomId, socket.id);
    
    if (success && state) {
      io.to(roomId).emit('game:state', state);
      console.log(`Game restarted in room ${roomId}`);
    }
    
    callback(success, error);
  });

  // 断开连接（标记离线，不立即移除）
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    const result = playerDisconnect(socket.id);
    
    if (result.roomId && result.playerId) {
      // 通知其他玩家（发送更新后的状态，包含离线标记）
      if (result.state) {
        socket.to(result.roomId).emit('game:state', result.state);
      }
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
