# Single stage build
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

RUN npm prune --production

EXPOSE 3000

CMD ["node", "dist/main.js"]
