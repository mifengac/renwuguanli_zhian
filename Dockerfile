FROM node:20-bookworm-slim AS base

RUN npm config set registry https://registry.npmmirror.com
RUN apt-get update \
  && apt-get install -y --no-install-recommends libaio1 libnsl2 unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient

FROM base AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
COPY oracle/instantclient/ ${ORACLE_CLIENT_LIB_DIR}/
RUN echo "${ORACLE_CLIENT_LIB_DIR}" > /etc/ld.so.conf.d/oracle-instantclient.conf \
  && ldconfig

ENV DATABASE_URL="postgresql://placeholder/placeholder"
RUN npx prisma generate

RUN npm run build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY oracle/instantclient/ ${ORACLE_CLIENT_LIB_DIR}/
RUN echo "${ORACLE_CLIENT_LIB_DIR}" > /etc/ld.so.conf.d/oracle-instantclient.conf \
  && ldconfig

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 3000

CMD ["npm", "run", "start"]
