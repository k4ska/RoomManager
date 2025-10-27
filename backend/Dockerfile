FROM mirror.gcr.io/library/node:20-bookworm-slim
WORKDIR /app

# System deps (OpenSSL) for Prisma engines
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack
RUN corepack enable && corepack use pnpm@10.18.3

# Copy manifest and install deps
COPY package.json ./
COPY prisma ./prisma
ARG PNPM_REGISTRY=https://registry.npmjs.org
RUN pnpm config set registry ${PNPM_REGISTRY} \
 && pnpm install --prefer-offline --no-frozen-lockfile \
 && pnpm exec prisma generate

# Copy source code
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
