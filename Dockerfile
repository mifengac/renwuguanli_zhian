FROM node:20-bookworm-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
ENV ORACLE_CLIENT_SRC_DIR=/tmp/oracle/instantclient_11_2
ENV ORACLE_CLIENT_LIB_DIR=/opt/oracle/instantclient

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources \
  && npm config set registry https://registry.npmmirror.com \
  && apt-get update \
  && apt-get install -y --no-install-recommends libaio1 libnsl2 unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
COPY instantclient_11_2/ ${ORACLE_CLIENT_SRC_DIR}/
RUN ls "${ORACLE_CLIENT_SRC_DIR}"/libclntsh.so* "${ORACLE_CLIENT_SRC_DIR}"/libnnz*.so "${ORACLE_CLIENT_SRC_DIR}"/libocci.so* >/dev/null \
  && mkdir -p "${ORACLE_CLIENT_LIB_DIR}" \
  && cp -a "${ORACLE_CLIENT_SRC_DIR}/." "${ORACLE_CLIENT_LIB_DIR}/" \
  && echo "${ORACLE_CLIENT_LIB_DIR}" > /etc/ld.so.conf.d/oracle-instantclient.conf \
  && ldconfig

ENV DATABASE_URL="postgresql://placeholder/placeholder"
RUN npx prisma generate

RUN npm run build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY instantclient_11_2/ ${ORACLE_CLIENT_SRC_DIR}/
RUN ls "${ORACLE_CLIENT_SRC_DIR}"/libclntsh.so* "${ORACLE_CLIENT_SRC_DIR}"/libnnz*.so "${ORACLE_CLIENT_SRC_DIR}"/libocci.so* >/dev/null \
  && mkdir -p "${ORACLE_CLIENT_LIB_DIR}" \
  && cp -a "${ORACLE_CLIENT_SRC_DIR}/." "${ORACLE_CLIENT_LIB_DIR}/" \
  && echo "${ORACLE_CLIENT_LIB_DIR}" > /etc/ld.so.conf.d/oracle-instantclient.conf \
  && ldconfig

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 3000

CMD ["npm", "run", "start"]
