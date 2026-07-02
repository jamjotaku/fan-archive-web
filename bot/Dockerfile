FROM node:22-alpine

WORKDIR /app

# パッケージインストール
COPY package*.json ./
RUN npm ci

# ソースコードをコピーしてビルド
COPY . .
RUN npx tsc

# Botの起動
CMD ["node", "dist/bot.js"]
