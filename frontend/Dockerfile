ARG REGISTRY=""
ARG NODE_IMAGE=node:24.11-alpine3.21

# Use `${REGISTRY}${NODE_IMAGE}` so an empty `REGISTRY` doesn't produce
# an invalid image reference like `/node:24.11-alpine3.21`.
FROM ${NODE_IMAGE} AS builder
RUN npm install -g pnpm

WORKDIR /app

COPY ./package.json ./pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM ${NODE_IMAGE}

WORKDIR /app

COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD [ "node", ".output/server/index.mjs" ]
