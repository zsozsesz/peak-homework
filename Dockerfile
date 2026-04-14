# ---- Build stage ----
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:24-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install prisma CLI for running migrations (it's a devDependency but needed at runtime)
RUN npm install prisma --save-exact --no-save

COPY --from=builder /app/dist ./dist

# Copy prisma schema, migrations and config so `prisma migrate deploy` can run
COPY prisma ./prisma
COPY prisma.config.ts ./

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/src/main"]
