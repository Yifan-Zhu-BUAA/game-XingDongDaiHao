#!/bin/bash
# 远程部署脚本（拉取构建+配置Nginx+SSL证书+健康检查）
# 适配 Alibaba Cloud Linux / CentOS / RHEL

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[1/5] 远程服务器部署代码${NC}"
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 'cd /root/game-XingDongDaiHao && git pull origin main && cd server && npm run build 2>&1 | tail -5 && cd .. && NODE_ENV=production pm2 restart codenames || NODE_ENV=production pm2 start npm --name "codenames" -- start'
echo -e "${GREEN}✅ 代码部署完成${NC}"

echo -e "${YELLOW}[2/5] 安装 Nginx${NC}"
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 '
  if ! command -v nginx &> /dev/null; then
    echo "正在安装 Nginx..."
    curl -fsSL -o /tmp/nginx.rpm "http://nginx.org/packages/centos/8/x86_64/RPMS/nginx-1.24.0-1.el8.ngx.x86_64.rpm" || \
    curl -fsSL -o /tmp/nginx.rpm "http://nginx.org/packages/centos/9/x86_64/RPMS/nginx-1.24.0-1.el9.ngx.x86_64.rpm"
    rpm -ivh /tmp/nginx.rpm --nodeps 2>/dev/null || yum localinstall /tmp/nginx.rpm -y --nogpgcheck
  fi
  echo "Nginx 版本: $(nginx -v 2>&1)"
'
echo -e "${GREEN}✅ Nginx 安装完成${NC}"

echo -e "${YELLOW}[3/5] 配置 SSL 证书${NC}"
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 '
  # 安装 acme.sh（如果未安装）
  if [ ! -f "$HOME/.acme.sh/acme.sh" ]; then
    echo "正在安装 acme.sh..."
    curl https://get.acme.sh | sh -s email=your-email@example.com
  fi
  
  # 创建 SSL 目录
  mkdir -p /etc/nginx/ssl
  
  # 申请证书（如果不存在）
  if [ ! -f "/etc/nginx/ssl/xddh.connectgame.me.crt" ]; then
    echo "正在申请 SSL 证书..."
    nginx -s stop 2>/dev/null || true
    $HOME/.acme.sh/acme.sh --issue -d xddh.connectgame.me --standalone --force
    $HOME/.acme.sh/acme.sh --install-cert -d xddh.connectgame.me \
      --cert-file /etc/nginx/ssl/xddh.connectgame.me.crt \
      --key-file /etc/nginx/ssl/xddh.connectgame.me.key \
      --fullchain-file /etc/nginx/ssl/xddh.connectgame.me.fullchain.crt
    nginx
  else
    echo "SSL 证书已存在，跳过申请"
  fi
'
echo -e "${GREEN}✅ SSL 证书配置完成${NC}"

echo -e "${YELLOW}[4/5] 配置 Nginx 反向代理${NC}"
sshpass -p 'Zyf86979196' ssh -o StrictHostKeyChecking=no root@8.134.10.196 '
  # 复制配置文件
  cp /root/game-XingDongDaiHao/nginx/xddh.connectgame.me.conf /etc/nginx/conf.d/
  
  # 禁用默认配置
  mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true
  
  # 测试并重载 Nginx
  nginx -t && nginx -s reload 2>/dev/null || nginx
  
  # 防火墙放行
  firewall-cmd --permanent --add-service=http 2>/dev/null || true
  firewall-cmd --permanent --add-service=https 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
'
echo -e "${GREEN}✅ Nginx 配置完成${NC}"

echo -e "${YELLOW}[5/5] 健康检查${NC}"
sleep 3

for i in 1 2 3; do
  # 检查 HTTPS 访问
  HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://xddh.connectgame.me 2>/dev/null || echo "000")
  if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS 访问正常 (200)${NC}"
    break
  fi
  
  # 检查 HTTP 重定向
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://xddh.connectgame.me 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "308" ]; then
    echo -e "${GREEN}✅ HTTP 重定向正常 (${HTTP_STATUS})${NC}"
    break
  fi
  
  if [ "$i" -eq 3 ]; then
    echo -e "${RED}❌ 健康检查失败 HTTP:${HTTP_STATUS} HTTPS:${HTTPS_STATUS}${NC}"
    exit 1
  fi
  echo "等待服务启动... (重试 $i/3)"
  sleep 2
done

echo ""
echo -e "${GREEN}🎉 部署完成!${NC}"
echo -e "${GREEN}   HTTPS 访问: https://xddh.connectgame.me${NC}"
echo -e "${GREEN}   HTTP 访问:  http://xddh.connectgame.me (自动跳转 HTTPS)${NC}"
