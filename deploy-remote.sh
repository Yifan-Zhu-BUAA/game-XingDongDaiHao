#!/bin/bash
# 远程部署脚本（仅拉取构建重启+健康检查）

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[1/2] 远程服务器部署${NC}"
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 'cd /root/game-XingDongDaiHao && git pull origin main && cd server && npm run build 2>&1 | tail -5 && cd .. && NODE_ENV=production pm2 restart codenames'
echo -e "${GREEN}✅ 远程部署完成${NC}"

echo -e "${YELLOW}[2/2] 健康检查${NC}"
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

echo -e "${GREEN}🎉 部署完成! http://8.134.10.196:3000${NC}"
