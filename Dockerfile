# ---------- STAGE 1: build (frontend + server deps) ----------
FROM node:20-bookworm-slim AS builder

LABEL org.opencontainers.image.version="3.5.1"
LABEL org.opencontainers.image.title="Lynx"
LABEL org.opencontainers.image.description="Your personal links hub"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/Lynx"

# Tool necessari per dipendenze native (es. sqlite3) + cert
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    python3 make g++ \
    ca-certificates \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

# --- Frontend (cartella: /LYNX) ---
WORKDIR /app/LYNX
COPY LYNX/package*.json ./
RUN npm ci
COPY LYNX/ ./
RUN npm run build

# --- Server (cartella: /LYNX/server) ---
WORKDIR /app/LYNX/server
COPY LYNX/server/package*.json ./
RUN npm ci --omit=dev
# Copy server source files only (not node_modules or .db files)
COPY LYNX/server/*.js ./

# ---------- STAGE 2: runtime ----------
FROM node:20-bookworm-slim

# sqlite runtime + cert
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    sqlite3 \
    ca-certificates \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia build frontend (Vite -> dist) e server già pronto con node_modules
COPY --from=builder /app/LYNX/dist /app/dist
COPY --from=builder /app/LYNX/server /app/server

# entrypoint (quello che controlla JWT_SECRET)
COPY docker-entrypoint.sh /app/server/docker-entrypoint.sh
RUN chmod +x /app/server/docker-entrypoint.sh

# Set default PORT environment variable
ENV PORT=8080

# Porta/e usate dal tuo stack (lasciamo entrambe)
EXPOSE 8080 8443

WORKDIR /app/server
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
