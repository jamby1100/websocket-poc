
## Server Commands

```sh
# run it manually
npm run server

# run it via Docker
docker build -t websocket-server .
docker run -p 3000:3000 -it \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  websocket-server
```

```js
start
```

## Client Commands

```sh
npm run client
```

```js
connect
join user-room-12345
leave
```

## Publisher

```sh
REDIS_HOST=localhost REDIS_PORT=6379 node redis-publisher.js
```

```js
test
send user-room-12345 "this is a message"
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

