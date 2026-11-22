FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "src/index.js"]
