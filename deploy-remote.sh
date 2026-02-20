#!/bin/bash
# 远程部署脚本（拉取构建+配置Nginx+健康检查）

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[1/4] 远程服务器部署代码${NC}"
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 'cd /root/game-XingDongDaiHao && git pull origin main && cd server && npm run build 2>&1 | tail -5 && cd .. && NODE_ENV=production pm2 restart codenames || NODE_ENV=production pm2 start npm --name "codenames" -- start'
echo -e "${GREEN}✅ 代码部署完成${NC}"

echo -e "${YELLOW}[2/4] 配置 Nginx 反向代理${NC}"
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 '
  # 安装 Nginx（如果未安装）
  if ! command -v nginx &> /dev/null; then
    apt update && apt install nginx -y
  fi
  
  # 复制配置文件
  cp /root/game-XingDongDaiHao/nginx/xddh.connectgame.me.conf /etc/nginx/sites-available/
  
  # 启用配置
  ln -sf /etc/nginx/sites-available/xddh.connectgame.me.conf /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  
  # 测试并重载
  nginx -t && systemctl restart nginx
  
  # 防火墙放行
  ufw allow "Nginx Full" 2>/dev/null || true
'
echo -e "${GREEN}✅ Nginx 配置完成${NC}"

echo -e "${YELLOW}[3/4] 等待服务启动${NC}"
sleep 3

echo -e "${YELLOW}[4/4] 健康检查${NC}"
for i in 1 2 3; do
  # 检查直接访问
  HEALTH=$(curl -s http://8.134.10.196:3000/api/health 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"ok"'; then
    echo -e "${GREEN}✅ 服务正常: $HEALTH${NC}"
    break
  fi
  if [ "$i" -eq 3 ]; then
    echo -e "${RED}❌ 健康检查失败${NC}"
    exit 1
  fi
  echo "等待服务启动... (重试 $i/3)"
  sleep 2
done

echo ""
echo -e "${GREEN}🎉 部署完成!${NC}"
echo -e "${GREEN}   域名访问: http://xddh.connectgame.me${NC}"
echo -e "${GREEN}   IP 访问:  http://8.134.10.196:3000${NC}"
