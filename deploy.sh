#!/bin/bash
# 行动代号 - 一键部署脚本
# 用法: ./deploy.sh [commit message]
# 示例: ./deploy.sh "feat: 新增功能"
#       ./deploy.sh              # 自动生成提交信息

set -e

SERVER="root@8.134.10.196"
SERVER_PWD="Zyf86979196"
REMOTE_DIR="/root/game-XingDongDaiHao"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 确保在项目根目录
cd "$(dirname "$0")"

echo -e "${YELLOW}🚀 开始部署...${NC}\n"

# 1. 本地构建
echo -e "${YELLOW}[1/4] 本地构建${NC}"
npm run build 2>&1 | tail -5
echo -e "${GREEN}✅ 构建通过${NC}\n"

# 2. Git提交推送
echo -e "${YELLOW}[2/4] Git提交推送${NC}"
git add -A
if git diff --cached --quiet; then
  echo "没有新的更改，跳过提交"
else
  MSG="${1:-update: $(date '+%Y-%m-%d %H:%M')}"
  git commit -m "$MSG"
  echo -e "${GREEN}✅ 已提交: $MSG${NC}"
fi
git push origin main
echo -e "${GREEN}✅ 已推送到远程仓库${NC}\n"

# 3. 远程部署
echo -e "${YELLOW}[3/4] 远程服务器部署${NC}"
# 先更新服务端代码并构建
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 'cd /root/game-XingDongDaiHao && git pull origin main && cd server && npm run build 2>&1 | tail -5'
# 同步本地构建的前端文件到服务器
echo "同步前端构建文件..."
# 先删除服务器上的旧文件
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 'rm -rf /root/game-XingDongDaiHao/client/dist/*'
# 使用 scp 复制新文件
sshpass -p 'Zyf86979196' scp -o StrictHostKeyChecking=no -r client/dist/* root@8.134.10.196:/root/game-XingDongDaiHao/client/dist/
# 重启服务
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 'cd /root/game-XingDongDaiHao && NODE_ENV=production pm2 restart codenames'
echo -e "${GREEN}✅ 远程部署完成${NC}\n"

# 4. 健康检查
echo -e "${YELLOW}[4/4] 健康检查${NC}"
sleep 3
for i in 1 2 3; do
  HEALTH=$(curl -s http://8.134.10.196:3000/api/health)
  if echo "$HEALTH" | grep -q '"ok"'; then
    echo -e "${GREEN}✅ 服务正常: $HEALTH${NC}"
    break
  fi
  if [ "$i" -eq 3 ]; then
    echo -e "${RED}❌ 健康检查失败: $HEALTH${NC}"
    exit 1
  fi
  echo "等待服务启动... (重试 $i/3)"
  sleep 2
done

echo -e "\n${GREEN}🎉 部署完成! 访问: http://8.134.10.196:3000${NC}"
