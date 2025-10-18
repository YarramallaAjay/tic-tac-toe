# Docker Deployment Guide

This guide explains how to deploy the Tic-Tac-Toe application using Docker.

## Prerequisites

- Docker installed (v20.10 or higher)
- Docker Compose installed (v2.0 or higher)

## Quick Start

### 1. Using Docker Compose (Recommended)

This will start all services including PostgreSQL database:

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3100
- PostgreSQL: localhost:5432

### 2. Stop Services

```bash
docker-compose down

# To remove volumes as well (clears database)
docker-compose down -v
```

## Configuration

### Backend Environment Variables

The backend uses the following environment variables (configured in docker-compose.yml):

- `DATABASE_URL`: PostgreSQL connection string
- `SERVER_URL`: Backend server URL for generating game links

### Frontend Environment Variables

The frontend connects to the backend at `http://localhost:3100` by default. This is hardcoded in the App.tsx file.

## Database

The docker-compose setup includes:
- PostgreSQL 15 Alpine
- Automatic database initialization
- Prisma migrations run automatically on startup
- Data persisted in Docker volume `postgres_data`

## Manual Docker Build (Without Docker Compose)

### Build Images

```bash
# Build backend
cd backend
docker build -t tictactoe-backend .

# Build frontend
cd ../frontend
docker build -t tictactoe-frontend .
```

### Run Containers

```bash
# Run PostgreSQL
docker run -d \
  --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=tictactoe \
  -p 5432:5432 \
  postgres:15-alpine

# Run backend
docker run -d \
  --name backend \
  -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/tictactoe \
  -p 3100:3100 \
  --link postgres \
  tictactoe-backend

# Run frontend
docker run -d \
  --name frontend \
  -p 5173:5173 \
  tictactoe-frontend
```

## Troubleshooting

### Database Connection Issues

If the backend can't connect to PostgreSQL:
```bash
# Check if PostgreSQL is ready
docker-compose logs postgres

# Restart backend after database is ready
docker-compose restart backend
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Reset Database

```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Production Deployment

For production deployment:

1. Update `docker-compose.yml` to use production database credentials
2. Set proper CORS origins in backend
3. Use environment-specific .env files
4. Consider using a reverse proxy (nginx) in front of services
5. Enable HTTPS
6. Set up proper logging and monitoring

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Frontend   │────────>│   Backend   │────────>│  PostgreSQL │
│  (Port 5173)│         │  (Port 3100)│         │  (Port 5432)│
│   Vite      │         │  Socket.IO  │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
```

## Notes

- The current setup uses Vite's preview mode for serving the frontend. This is suitable for development and small-scale deployments.
- For large-scale production, consider using nginx or a CDN to serve the frontend static files.
- Database migrations run automatically on backend startup using `prisma migrate deploy`.
