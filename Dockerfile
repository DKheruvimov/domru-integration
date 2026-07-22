# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dev dependencies and build assets
COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Run build script to bundled server and static client assets
RUN npm run build

# Runtime Stage
FROM node:20-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled backend and frontend assets
COPY --from=builder /app/dist ./dist

# Copy folders required by code browser at runtime
COPY --from=builder /app/src/domru-api ./src/domru-api
COPY --from=builder /app/server/views ./server/views

EXPOSE 3000
EXPOSE 5060/udp

CMD ["npm", "start"]
