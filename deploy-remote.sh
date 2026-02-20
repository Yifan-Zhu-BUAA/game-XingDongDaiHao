#!/bin/bash
# 远程部署脚本（拉取构建+配置Nginx+健康检查）
# 适配 Alibaba Cloud Linux / CentOS / RHEL

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
  # 安装 Nginx（如果未安装）- 适配 Alibaba Cloud Linux
  if ! command -v nginx &> /dev/null; then
    echo "正在安装 Nginx..."
    # 下载 CentOS 8 的 nginx rpm 包
    curl -fsSL -o /tmp/nginx.rpm "http://nginx.org/packages/centos/8/x86_64/RPMS/nginx-1.24.0-1.el8.ngx.x86_64.rpm" || \
    curl -fsSL -o /tmp/nginx.rpm "http://nginx.org/packages/centos/9/x86_64/RPMS/nginx-1.24.0-1.el9.ngx.x86_64.rpm"
    rpm -ivh /tmp/nginx.rpm --nodeps 2>/dev/null || yum localinstall /tmp/nginx.rpm -y --nogpgcheck
  fi
  
  # 复制配置文件
  mkdir -p /etc/nginx/conf.d
  cp /root/game-XingDongDaiHao/nginx/xddh.connectgame.me.conf /etc/nginx/conf.d/
  
  # 禁用默认配置
  mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true
  
  # 测试并重载
  nginx -t && (nginx -s reload 2>/dev/null || nginx)
  
  # 防火墙放行
  firewall-cmd --permanent --add-service=http 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
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
