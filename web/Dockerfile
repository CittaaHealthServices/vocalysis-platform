FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npm install -g serve
COPY . .
RUN npm run build
EXPOSE 8080
CMD sh -c "serve dist -l ${PORT:-8080} --single"
