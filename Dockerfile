FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

RUN npm ci

ARG DATABASE_URL=postgresql://x:x@x:5432/x
ENV DATABASE_URL=$DATABASE_URL
RUN npx prisma generate

COPY . .

RUN npm run build


FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

ARG DATABASE_URL=postgresql://x:x@x:5432/x
ENV DATABASE_URL=$DATABASE_URL
RUN npm ci && npx prisma generate && npm prune --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
