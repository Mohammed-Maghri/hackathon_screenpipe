# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# The browser preview does not use Electron or its binary installer.
RUN npm ci --ignore-scripts
COPY src ./src
COPY backend/src/contracts ./backend/src/contracts
COPY vite.web.config.ts ./
RUN npm run build:web

FROM nginx:stable-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web /usr/share/nginx/html
EXPOSE 8080
