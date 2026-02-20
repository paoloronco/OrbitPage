# ---------- STAGE 1: build (frontend + server deps) ----------
FROM node:20-alpine AS builder

LABEL org.opencontainers.image.version="3.5.3"
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
RUN npm run build

# --- Server (cartella: /LYNX/server) ---
WORKDIR /app/LYNX/server
COPY LYNX/server/package*.json ./
RUN npm ci --omit=dev --omit=optional
# Copy server source files only (not node_modules or .db files)
COPY LYNX/server/*.js ./

# ---------- STAGE 2: runtime ----------
FROM node:20-alpine

LABEL org.opencontainers.image.version="3.5.3"
LABEL org.opencontainers.image.title="Lynx"
LABEL org.opencontainers.image.description="Your personal links hub"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/Lynx"

# sqlite runtime
RUN apk add --no-cache sqlite

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
