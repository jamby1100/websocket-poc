# Redis Streams Adapter Setup

This document explains how to run the WebSocket server with Redis Streams adapter for connection state recovery and horizontal scaling with multiple server instances.

## Features

- **Connection State Recovery**: Clients can automatically recover their connection state after temporary disconnections
- **Horizontal Scaling**: Run multiple WebSocket server instances that communicate via Redis
- **Load Balancing**: Nginx distributes clients across multiple servers
- **Persistent Sessions**: Redis ensures messages are synchronized across all server instances

## Architecture

```
Client → Nginx (Port 3000) → Load Balanced across:
                              ├─ WebSocket Server 1 (Port 3001)
                              ├─ WebSocket Server 2 (Port 3002)
                              └─ WebSocket Server 3 (Port 3003)
                                        ↓
                                  Redis Server
```

## Quick Start

### Option 1: Docker Compose (Recommended for Multi-Server Setup)

This will start Redis + 3 WebSocket servers + Nginx load balancer:

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Access Points:**
- Load-balanced endpoint: `http://localhost:3000` (via Nginx)
- Direct server access:
  - Server 1: `http://localhost:3001`
  - Server 2: `http://localhost:3002`
  - Server 3: `http://localhost:3003`
- Redis: `localhost:6379`

### Option 2: Single Docker Container with External Redis

```bash
# Start Redis first
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Build the WebSocket server image
docker build -t websocket-server .

# Run the server with Redis connection
docker run -p 3000:3000 -it \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  -e SERVER_ID=server-1 \
  websocket-server
```

### Option 3: Local Development with Redis

```bash
# Install dependencies
npm install

# Start Redis (if not already running)
docker run -d --name redis -p 6379:6379 redis:7-alpine
# OR if you have Redis installed locally
redis-server

# Run the server
REDIS_HOST=localhost REDIS_PORT=6379 npm run server
```

## Interacting with the Server

Once a server starts, you'll see the CLI prompt. Type `start` to begin the WebSocket server:

```
SERVER> start
```

The server will connect to Redis and start listening on port 3000 (or the mapped port).

### Available Commands

- `start` - Start the WebSocket server and connect to Redis
- `stop` - Stop the server and disconnect from Redis
- `status` - Show server status including Redis connection
- `rooms` - List all active rooms
- `clients` - List all connected clients
- `broadcast <message>` - Send message to all clients
- `sendroom <roomId> <message>` - Send message to specific room
- `exit` - Shutdown server

## Testing Multi-Server Setup

You can test that multiple servers are working together:

1. Start the multi-server setup:
   ```bash
   docker-compose up --build
   ```

2. Attach to server 1 and start it:
   ```bash
   docker attach socketio-server-1
   SERVER> start
   ```

3. In another terminal, attach to server 2 and start it:
   ```bash
   docker attach socketio-server-2
   SERVER> start
   ```

4. Connect clients to the load balancer at `http://localhost:3000`

5. Messages sent to rooms will be synchronized across all servers via Redis

## Connection State Recovery

The server is configured with connection state recovery that:

- Stores connection state for up to 2 minutes after disconnection
- Automatically restores client state when they reconnect
- Preserves room memberships and pending messages

When a client reconnects after a brief disconnection, you'll see:
```
[RECOVERY] Client reconnected (recovered): <socket-id>
```

## Environment Variables

- `REDIS_HOST` - Redis server hostname (default: `localhost`)
- `REDIS_PORT` - Redis server port (default: `6379`)
- `SERVER_ID` - Unique identifier for this server instance (auto-generated if not set)
- `NODE_ENV` - Node environment (default: `production` in Docker)

## Scaling

To add more server instances:

1. Edit [docker-compose.yml](docker-compose.yml) and add new services:
   ```yaml
   websocket-server-4:
     build: .
     container_name: socketio-server-4
     ports:
       - "3004:3000"
     environment:
       - REDIS_HOST=redis
       - REDIS_PORT=6379
       - SERVER_ID=server-4
   ```

2. Update [nginx.conf](nginx.conf) to include the new server:
   ```nginx
   upstream socketio_backend {
       server websocket-server-4:3000;
   }
   ```

3. Restart: `docker-compose up -d --build`

## Monitoring Redis

```bash
# Connect to Redis CLI
docker exec -it socketio-redis redis-cli

# Monitor all commands
MONITOR

# Check connected clients
CLIENT LIST

# View keys (Socket.IO streams)
KEYS *

# Check stream info
XINFO STREAM socket.io#/#
```

## Troubleshooting

### Server won't connect to Redis

- Check Redis is running: `docker ps | grep redis`
- Verify Redis port: `docker port socketio-redis`
- Check logs: `docker-compose logs redis`

### Messages not syncing between servers

- Ensure all servers are connected to the same Redis instance
- Check Redis logs for errors
- Verify the Redis adapter is initialized (look for `[REDIS] Redis Streams adapter initialized`)

### Nginx not load balancing

- Check nginx logs: `docker-compose logs nginx`
- Verify all servers are healthy: `docker-compose ps`
- Test direct server access using ports 3001, 3002, 3003

## Production Considerations

1. **Redis Persistence**: The docker-compose setup enables AOF persistence. For production, consider also enabling RDB snapshots.

2. **Redis Security**: Add password authentication:
   ```yaml
   redis:
     command: redis-server --requirepass your-password
   ```

3. **Health Checks**: The setup includes health checks for Redis. Consider adding health checks for the WebSocket servers.

4. **Resource Limits**: Add resource constraints in docker-compose:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '0.5'
         memory: 512M
   ```

5. **SSL/TLS**: For production, configure Nginx with SSL certificates.

6. **Monitoring**: Use Redis monitoring tools like RedisInsight or integrate with your monitoring stack.
