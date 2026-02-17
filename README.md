# 行动代号 (Codenames)

在线多人猜词游戏，支持 2-8 人游玩。

## 游戏规则

- 玩家分为红蓝两队，每队有队长
- 25张词语卡片，队长知道每张牌的颜色（红/蓝/白/黑）
- 队长给线索：`描述 + 数字`（如"动物，3"）
- 队员猜词：猜对本队继续，猜错/白色换队，猜黑色直接输

## 技术栈

- 前端：React + TypeScript + Tailwind CSS + Socket.io-client
- 后端：Node.js + Express + Socket.io
- 数据库：内存存储（可扩展Redis/Supabase）

## 开发

```bash
npm install
npm run dev
```

## 部署

项目已配置 Render 自动部署，推送代码到 GitHub 即可自动部署。
