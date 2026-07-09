# ---------- STAGE 1: build (frontend + server deps) ----------
FROM node:22-alpine AS builder

LABEL org.opencontainers.image.version="4.3.12"
LABEL org.opencontainers.image.title="Lynx"
LABEL org.opencontainers.image.description="Your personal links hub"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/Lynx"

# Tool necessari per dipendenze native (es. sqlite3)
RUN apk add --no-cache python3 make g++

# --- Frontend (cartella: /LYNX) ---
WORKDIR /app/LYNX
COPY LYNX/package*.json ./
RUN npm ci
COPY LYNX/ ./
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

# --- Server (cartella: /LYNX/server) ---
WORKDIR /app/LYNX/server
COPY LYNX/server/package*.json ./
RUN npm ci --omit=dev --omit=optional
# Copy only production server source files (exclude test/debug scripts)
COPY LYNX/server/server.js ./
COPY LYNX/server/auth.js ./
COPY LYNX/server/database.js ./
COPY LYNX/server/schemas ./schemas

# ---------- STAGE 2: runtime ----------
FROM node:22-alpine

LABEL org.opencontainers.image.version="4.3.12"
LABEL org.opencontainers.image.title="Lynx"
LABEL org.opencontainers.image.description="Your personal links hub"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/Lynx"

# sqlite runtime
RUN apk add --no-cache sqlite

# npm is not needed at runtime; remove it to eliminate its bundled
# vulnerable packages (tar, minimatch, glob) from the final image
RUN npm uninstall -g npm

WORKDIR /app

# Copia build frontend (Vite -> dist) e server già pronto con node_modules
COPY --from=builder /app/LYNX/dist /app/dist
COPY --from=builder /app/LYNX/server /app/server

# entrypoint (quello che controlla JWT_SECRET)
COPY docker-entrypoint.sh /app/server/docker-entrypoint.sh
RUN chmod +x /app/server/docker-entrypoint.sh

# Bundle the update script so the host can extract it:
#   docker run --rm --entrypoint cat paueron/lynx:latest /app/lynx-update.sh \
#     > /usr/local/bin/lynx-update && chmod +x /usr/local/bin/lynx-update
COPY scripts/lynx-update.sh /app/lynx-update.sh
RUN chmod +x /app/lynx-update.sh

# Set default PORT environment variable
ENV PORT=8080

# Persistent data directory — mount a volume here to survive container updates:
#   docker run -v /host/path/lynx-data:/app/data ...
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

# Porta/e usate dal tuo stack (lasciamo entrambe)
EXPOSE 8080 8443

WORKDIR /app/server
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]


