# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package.json
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建前端和后端
RUN npm run build

# 运行阶段
FROM node:20-alpine

WORKDIR /app

# 复制生产依赖
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/package.json ./

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
