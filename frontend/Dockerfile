# 前端生产环境 Dockerfile

# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖（使用国内镜像加速）
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci --silent

# 复制源代码
COPY . .

# 构建生产版本
RUN npm run build


# 运行阶段 - 使用 Nginx 托管静态文件
FROM nginx:alpine AS runner

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
