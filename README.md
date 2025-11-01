
## Server Commands

```sh
# run it manually
npm run server

REDIS_HOST=master.websocket-redis-correct.vghwpa.apse1.cache.amazonaws.com REDIS_PORT=6379 REDIS_TLS=true REDIS_TLS_REJECT_UNAUTHORIZED=false npm run server

# run it via Docker
docker build -t websocket-server .
docker run -p 3000:3000 -it \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  websocket-server
```

```js
start
sendroom user-room-12345 "Here's a message from the server"
```

## Client Commands

```sh
# Connect to localhost (default)
npm run client
npm run rider

# Connect to a custom server
WEBSOCKET_SERVER=54.169.75.241 npm run client

# Specify custom server and port
WEBSOCKET_SERVER=example.com WEBSOCKET_PORT=8080 npm run client
```

**Environment Variables:**
- `WEBSOCKET_SERVER` - WebSocket server host (default: `localhost`)
- `WEBSOCKET_PORT` - WebSocket server port (default: `3000`)

```js
connect
join user-room-12345
send "Here's a message from the client"
leave
```

## Publisher

Since the Redis ElastiCache is inside the VPC, it can only be accessed from within the network

```sh
REDIS_HOST=localhost REDIS_PORT=6379 node redis-publisher.js

REDIS_HOST=master.websocket-redis-correct.vghwpa.apse1.cache.amazonaws.com REDIS_PORT=6379 REDIS_TLS=true REDIS_TLS_REJECT_UNAUTHORIZED=false node redis-publisher.js
```

```js
test
send user-room-12345 "Here's a message from the emitter"
```

## Building in Docker

```sh
docker build -t websocket-server .
docker run -p 3600:3600 -it \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  websocket-server


docker exec -it socketio-redis redis-cli

```

## ECS

```sh

aws ecr create-repository \
    --repository-name poc/websocket-server \
    --encryption-configuration encryptionType=AES256 \
    --image-tag-mutability MUTABLE \
    --profile personal \
    --region ap-southeast-1

aws ecr get-login-password --region ap-southeast-1 --profile personal | docker login --username AWS --password-stdin $(aws sts get-caller-identity --profile personal --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com

docker build -t websocket-server .

docker tag websocket-server:latest $(aws sts get-caller-identity --profile personal --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com/poc/websocket-server:latest

docker push $(aws sts get-caller-identity --profile personal --query Account --output text).dkr.ecr.ap-southeast-1.amazonaws.com/poc/websocket-server:latest


```

