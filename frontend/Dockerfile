# Multi-stage build para SafeEntry frontend (React + Vite)

# Etapa 1: Build con Node
FROM node:20-alpine AS builder
WORKDIR /app

# Argumentos en build-time para incrustar en el bundle de Vite
ARG VITE_API_URL=http://localhost:5000/api
ARG VITE_POWERBI_EMBED_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_POWERBI_EMBED_URL=$VITE_POWERBI_EMBED_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa 2: Servir con nginx
FROM nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
