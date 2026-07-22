# ---------- STAGE 1: build (frontend + server deps) ----------
FROM node:22-alpine AS builder

LABEL org.opencontainers.image.version="4.17.9"
LABEL org.opencontainers.image.title="OrbitPage"
LABEL org.opencontainers.image.description="Self-hosted public page manager"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/OrbitPage"

RUN apk add --no-cache python3 make g++

WORKDIR /app/source
COPY package*.json ./
RUN npm ci
COPY . ./
ARG VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE=true
ARG VITE_USERCENTRICS_PRIVACY_POLICY_ID=fd1ffcdf-b560-4ea0-ba72-da943d39d953
ARG VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE=en
ARG VITE_DEFAULT_PRIVACY_POLICY_URL=/privacy
ENV VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE=${VITE_ENABLE_USERCENTRICS_PRIVACY_PAGE}
ENV VITE_USERCENTRICS_PRIVACY_POLICY_ID=${VITE_USERCENTRICS_PRIVACY_POLICY_ID}
ENV VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE=${VITE_USERCENTRICS_PRIVACY_POLICY_LANGUAGE}
ENV VITE_DEFAULT_PRIVACY_POLICY_URL=${VITE_DEFAULT_PRIVACY_POLICY_URL}
RUN rm -rf dist
RUN npm run build

WORKDIR /app/source/server
COPY server/package*.json ./
RUN npm ci --omit=dev --omit=optional

# ---------- STAGE 2: runtime ----------
FROM node:22-alpine

LABEL org.opencontainers.image.version="4.17.9"
LABEL org.opencontainers.image.title="OrbitPage"
LABEL org.opencontainers.image.description="Self-hosted public page manager"
LABEL org.opencontainers.image.source="https://github.com/paoloronco/OrbitPage"

RUN apk add --no-cache sqlite
RUN npm uninstall -g npm

WORKDIR /app
COPY --from=builder /app/source/dist /app/dist
COPY --from=builder /app/source/server /app/server

COPY docker-entrypoint.sh /app/server/docker-entrypoint.sh
RUN chmod +x /app/server/docker-entrypoint.sh

ENV PORT=8080
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 8080 8443

WORKDIR /app/server
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]


