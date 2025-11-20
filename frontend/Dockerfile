ARG REGISTRY=""
ARG NODE_IMAGE=node:24.11-alpine3.21

# If you set `REGISTRY`, include the trailing slash (for example: ghcr.io/myorg/)
# so the final image reference becomes ${REGISTRY}${NODE_IMAGE} (e.g. ghcr.io/myorg/node:...).
FROM ${REGISTRY}${NODE_IMAGE} AS builder
RUN npm install -g pnpm

WORKDIR /app

COPY ./package.json ./pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM ${REGISTRY}${NODE_IMAGE}

WORKDIR /app

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD [ "node", ".output/server/index.mjs" ]
