# ================================
# Admin Residencial - Dockerfile
# ================================

# Etapa 1: Base
FROM node:18-alpine AS base
WORKDIR /app

# Etapa 2: Dependencias
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# Etapa 3: Builder (si fuera necesario build)
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .

# Etapa 4: Runner (producción)
FROM base AS runner

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copiar dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Copiar código fuente
COPY --chown=appuser:nodejs . .

# Crear directorio de logs
RUN mkdir -p logs && chown appuser:nodejs logs

# Cambiar a usuario no-root
USER appuser

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=5000

# Exponer puerto
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Comando de inicio
CMD ["node", "server.js"]
