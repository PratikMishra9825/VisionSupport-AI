# Stage 1: Build environment
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production runtime environment
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install bash/ffmpeg dependencies in case of native runtime issues
RUN apk add --no-cache bash ffmpeg

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]
