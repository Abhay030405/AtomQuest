# ---------------------------------------------------------------------------
# AtomQuest frontend — multi-stage build.
# Vercel does NOT use this file (it builds the Vite app natively). This image
# exists for local docker-compose and any self-hosted/containerised deploy.
# ---------------------------------------------------------------------------

# ---- Build stage ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* at build time, so the API URL is a build arg.
ARG VITE_API_URL=http://localhost:8000/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- Runtime stage --------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
