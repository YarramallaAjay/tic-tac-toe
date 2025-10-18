# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3100

# Start script will generate Prisma client and run migrations
CMD npx prisma generate && npx prisma migrate deploy && node dist/SocketHandler.js
