import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocketStore } from '../store/socketStore';

// 生成随机房间ID
function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成随机昵称
function generateRandomName(): string {
  const adjectives = ['快乐', '聪明', '勇敢', '可爱', '神秘', '机智', '善良', '活泼'];
  const nouns = ['小猫', '小狗', '兔子', '熊猫', '老虎', '狮子', '狐狸', '猴子'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return adj + noun;
}

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { joinRoom, isConnected } = useSocketStore();
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  
  // 获取从其他页面传来的房间号（用于邀请链接场景）
  const redirectRoomId = (location.state as { redirectRoomId?: string })?.redirectRoomId;
  
  // 如果有重定向房间号，显示提示
  useEffect(() => {
    if (redirectRoomId) {
      setRoomId(redirectRoomId);
    }
  }, [redirectRoomId]);

  // 创建房间或进入邀请房间
  const handleCreateRoom = async () => {
    if (!isConnected) {
      alert('请等待连接到服务器');
      return;
    }

    const name = playerName.trim() || generateRandomName();
    setIsJoining(true);
    
    // 如果有邀请房间号，直接进入；否则创建新房间
    const targetRoomId = redirectRoomId || generateRoomId();
    const success = await joinRoom(targetRoomId, name);
    setIsJoining(false);

    if (success) {
      navigate(`/room/${targetRoomId}`);
    }
  };

  // 加入房间
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert('请等待连接到服务器');
      return;
    }

    const targetRoomId = roomId.trim().toLowerCase();
    if (!targetRoomId) {
      alert('请输入房间号');
      return;
    }

    if (targetRoomId.length !== 4) {
      alert('房间号应为4位字符');
      return;
    }

    const name = playerName.trim() || generateRandomName();
    
    setIsJoining(true);
    const success = await joinRoom(targetRoomId, name);
    setIsJoining(false);

    if (success) {
      navigate(`/room/${targetRoomId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo和标题 */}
      <div className="text-center mb-12">
        <div className="w-24 h-24 bg-gradient-to-br from-game-red to-game-blue rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <span className="text-4xl">🎯</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-800 mb-2">行动代号</h1>
        <p className="text-gray-600">在线多人猜词游戏</p>
      </div>

      {/* 邀请提示 */}
      {redirectRoomId && (
        <div className="w-full max-w-md mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-center">
            你收到了房间 <strong>{redirectRoomId}</strong> 的邀请
          </p>
          <p className="text-blue-600 text-sm text-center mt-1">
            输入昵称后即可加入房间
          </p>
        </div>
      )}

      {/* 昵称输入 */}
      <div className="w-full max-w-md mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          你的昵称
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder={generateRandomName()}
          maxLength={8}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
        />
        <p className="text-xs text-gray-500 mt-1">
          可以是1个汉字、或1个表情、或2-4个英文
        </p>
      </div>

      {/* 操作按钮 */}
      <div className="w-full max-w-md space-y-4">
        {/* 创建房间 / 进入邀请房间 */}
        <button
          onClick={handleCreateRoom}
          disabled={isJoining || !isConnected}
          className="w-full bg-gradient-to-r from-game-red to-game-red-dark text-white py-4 rounded-lg font-semibold text-lg shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isJoining ? '加入中...' : redirectRoomId ? `👥 进入房间 ${redirectRoomId}` : '👥 创建房间'}
        </button>

        {/* 分割线 */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 text-gray-500">或</span>
          </div>
        </div>

        {/* 加入房间表单 */}
        <form onSubmit={handleJoinRoom} className="flex gap-2">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toLowerCase())}
            placeholder="输入房间号（4位）"
            maxLength={4}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition uppercase"
          />
          <button
            type="submit"
            disabled={isJoining || !isConnected || roomId.length !== 4}
            className="px-6 py-3 bg-game-blue text-white rounded-lg font-semibold hover:bg-game-blue-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? '...' : '进入'}
          </button>
        </form>
      </div>

      {/* 游戏规则简述 */}
      <div className="mt-12 text-center text-gray-500 text-sm max-w-md">
        <p className="mb-2">🎮 适合 2-8 人游玩</p>
        <p className="mb-2">👥 分为红蓝两队，队长给线索，队员猜词</p>
        <p>⚠️ 小心别猜中黑牌！</p>
      </div>

      {/* 页脚 */}
      <div className="mt-12 text-center text-gray-400 text-xs">
        <p>行动代号 © 2024</p>
      </div>
    </div>
  );
}
