FROM mirror.gcr.io/library/node:20-alpine AS build
WORKDIR /app

# Enable corepack and use pnpm (lockfile present)
RUN corepack enable && corepack use pnpm@10.18.3

# Copy only manifests first for better layer caching
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install deps deterministically
ARG PNPM_REGISTRY=https://registry.npmjs.org
RUN pnpm config set registry ${PNPM_REGISTRY} \
 && pnpm install --prefer-offline --no-frozen-lockfile

# Copy the rest of the source and build
COPY . .
RUN pnpm build

FROM mirror.gcr.io/library/node:20-alpine AS runner
WORKDIR /app

# Copy built output
COPY --from=build /app/.output ./.output

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
