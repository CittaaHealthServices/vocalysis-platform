# Stage 1: build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Accept VITE_ env vars as build args so Vite can bake them in
ARG VITE_API_URL
ARG VITE_APP_NAME=Vocalysis
ARG VITE_SUPPORT_EMAIL=support@cittaa.in
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL

RUN npm run build

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
EXPOSE 8080
# Substitute PORT at runtime, then start nginx
CMD sh -c "sed \"s/PORT_PLACEHOLDER/${PORT:-8080}/g\" /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
