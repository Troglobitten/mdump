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

# Install pnpm
RUN npm install -g pnpm

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
RUN mkdir -p /data/notes /data/config /data/.image-cache

# Environment variables
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV NOTES_DIR=/data/notes
ENV PORT=8080

# Expose port
EXPOSE 8080

# Volume for persistent data
VOLUME ["/data"]

# Start server
WORKDIR /app/server
CMD ["node", "dist/index.js"]
