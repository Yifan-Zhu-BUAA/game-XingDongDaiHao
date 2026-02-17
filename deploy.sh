#!/bin/bash
# 行动代号游戏 - 阿里云快速部署脚本

echo "🚀 开始部署行动代号游戏..."

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "${RED}❌ 错误：请在项目根目录运行此脚本${NC}"
    exit 1
fi

echo "${YELLOW}📦 步骤 1/5: 安装依赖...${NC}"
npm run install:all
if [ $? -ne 0 ]; then
    echo "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi

echo "${YELLOW}🔨 步骤 2/5: 构建项目...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo "${RED}❌ 构建失败${NC}"
    exit 1
fi

echo "${YELLOW}🚀 步骤 3/5: 启动服务...${NC}"
# 检查 pm2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "${YELLOW}📥 安装 pm2 进程管理器...${NC}"
    npm install -g pm2
fi

# 如果服务已存在，先删除
pm2 delete codenames 2>/dev/null

# 启动服务
pm2 start server/dist/index.js --name codenames
if [ $? -ne 0 ]; then
    echo "${RED}❌ 启动失败${NC}"
    exit 1
fi

echo "${YELLOW}💾 步骤 4/5: 保存配置...${NC}"
pm2 save
pm2 startup

echo "${GREEN}✅ 步骤 5/5: 部署完成！${NC}"
echo ""
echo "${GREEN}🎮 游戏已启动！${NC}"
echo ""
echo "📱 访问地址:"
echo "   本地: http://localhost:3000"
echo ""
echo "🔧 常用命令:"
echo "   查看状态: pm2 status"
echo "   查看日志: pm2 logs codenames"
echo "   重启服务: pm2 restart codenames"
echo "   停止服务: pm2 stop codenames"
echo ""

# 显示服务状态
pm2 status
