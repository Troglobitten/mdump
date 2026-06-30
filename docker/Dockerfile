# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY shared/package.json ./shared/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

# Build shared types
RUN pnpm --filter @mdump/shared build

# Build client
RUN pnpm --filter @mdump/client build

# Build server
RUN pnpm --filter @mdump/server build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm, su-exec (privilege drop) and wget (healthcheck); create app user
RUN npm install -g pnpm \
  && apk add --no-cache su-exec wget \
  && addgroup -S app && adduser -S app -G app

# Copy package files for production install
COPY package.json pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copy built artifacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Create data directories
RUN mkdir -p /data/notes /data/config /data/.image-cache /data/certs

# Entrypoint: fixes /data ownership then drops to the non-root app user
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV NOTES_DIR=/data/notes
ENV PORT=8080

# Expose port
EXPOSE 8080

# Volume for persistent data
VOLUME ["/data"]

# Container-level healthcheck (compose files also define one)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/api/auth/status || exit 1

# Start server (entrypoint drops privileges from root to the app user)
WORKDIR /app/server
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
