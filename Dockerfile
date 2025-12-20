FROM node:20-alpine AS builder

# 使用国内 npm 源，加速依赖安装
RUN npm config set registry https://registry.npmmirror.com

WORKDIR /app

# 仅复制依赖文件，利用 Docker 缓存
COPY package.json package-lock.json ./

# 使用 npm ci 确保与锁文件一致
RUN npm ci --ignore-scripts

# 复制其余源码（已通过 .dockerignore 排除本地 node_modules/.next 等）
COPY . .

# 生成 Prisma Client（如未使用 Prisma 可删除这一行）
# 在构建阶段提供一个占位的 DATABASE_URL，避免 prisma.config.ts 报错
ENV DATABASE_URL="postgresql://placeholder/placeholder"
RUN npx prisma generate

# 构建 Next.js 应用
RUN npm run build

FROM node:20-alpine AS runner

# 使用国内 npm 源（方便运行时需要安装额外包的情况）
RUN npm config set registry https://registry.npmmirror.com

WORKDIR /app

ENV NODE_ENV=production

# 仅安装生产依赖，减小镜像体积
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# 复制构建产物和必要配置
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 3000

CMD ["npm", "run", "start"]
