# ---------- STAGE 1: build (frontend + server deps) ----------
FROM node:22-alpine AS builder

LABEL org.opencontainers.image.version="4.17.6"
LABEL org.opencontainers.image.title="OrbitPage"
LABEL org.opencontainers.image.description="Self-hosted public page manager"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/OrbitPage"

# Tool necessari per dipendenze native (es. sqlite3)
RUN apk add --no-cache python3 make g++

# --- Frontend (app directory) ---
WORKDIR /app/source
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
ARG VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE=true
ARG VITE_USERCENTRICS_PRIVACY_POLICY_ID=fd1ffcdf-b560-4ea0-ba72-da943d39d953
ARG VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE=en
ARG VITE_DEFAULT_PRIVACY_POLICY_URL=/privacy
ENV VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE=${VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE}
ENV VITE_USERCENTRICS_PRIVACY_POLICY_ID=${VITE_USERCENTRICS_PRIVACY_POLICY_ID}
ENV VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE=${VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE}
ENV VITE_DEFAULT_PRIVACY_POLICY_URL=${VITE_DEFAULT_PRIVACY_POLICY_URL}
# Ensure clean build by removing any existing dist
RUN rm -rf dist
RUN npm run build

# --- Server (app/server directory) ---
WORKDIR /app/source/server
COPY app/server/package*.json ./
RUN npm ci --omit=dev --omit=optional
# Copy only production server source files (exclude test/debug scripts)
COPY app/server/server.js ./
COPY app/server/auth.js ./
COPY app/server/database.js ./
COPY app/server/schemas ./schemas
COPY app/server/services ./services

# ---------- STAGE 2: runtime ----------
FROM node:22-alpine

LABEL org.opencontainers.image.version="4.17.6"
LABEL org.opencontainers.image.title="OrbitPage"
LABEL org.opencontainers.image.description="Self-hosted public page manager"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/OrbitPage"

# sqlite runtime
RUN apk add --no-cache sqlite

# npm is not needed at runtime; remove it to eliminate its bundled
# vulnerable packages (tar, minimatch, glob) from the final image
RUN npm uninstall -g npm

WORKDIR /app

# Copia build frontend (Vite -> dist) e server già pronto con node_modules
COPY --from=builder /app/source/dist /app/dist
COPY --from=builder /app/source/server /app/server

# entrypoint (quello che controlla JWT_SECRET)
COPY docker-entrypoint.sh /app/server/docker-entrypoint.sh
RUN chmod +x /app/server/docker-entrypoint.sh

# Bundle the update script so the host can extract it:
#   docker run --rm --entrypoint cat paueron/orbitpage:latest /app/orbitpage-update.sh \
#     > /usr/local/bin/orbitpage-update && chmod +x /usr/local/bin/orbitpage-update
COPY scripts/orbitpage-update.sh /app/orbitpage-update.sh
RUN chmod +x /app/orbitpage-update.sh

# Set default PORT environment variable
ENV PORT=8080

# Persistent data directory — mount a volume here to survive container updates:
#   docker run -v /host/path/orbitpage-data:/app/data ...
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

# Porta/e usate dal tuo stack (lasciamo entrambe)
EXPOSE 8080 8443

WORKDIR /app/server
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]


