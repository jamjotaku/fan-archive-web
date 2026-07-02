FROM node:20-alpine

WORKDIR /app

# パッケージインストール
COPY package*.json ./
RUN npm ci

# ソースコードをコピーしてビルド
COPY . .
RUN npx tsc

# Botの起動
CMD ["node", "dist/bot.js"]
