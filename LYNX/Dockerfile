# Multi-stage Dockerfile
# Builder: install root dev deps and build the frontend
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy only package manifests to leverage layer caching
COPY package.json package-lock.json ./

# Install dependencies (including dev) for build
RUN npm ci

# Copy project files and build frontend
COPY . .
RUN npm run build

# Production image: install only server production deps and copy build output
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Copy server package manifests and install only production deps
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copy built frontend and server code
COPY --from=builder /app/dist ./dist
COPY server ./server

# Bundle the update script so the host can extract it via: docker cp
COPY scripts/lynx-update.sh /app/lynx-update.sh
RUN chmod +x /app/lynx-update.sh

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/server.js"]
