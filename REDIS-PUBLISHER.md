# Redis Publisher for Socket.IO

This tool allows you to publish messages directly to Redis that will be picked up by all WebSocket server instances and broadcast to rooms.

## Use Cases

- **External Systems Integration**: Allow external services to send messages to WebSocket rooms
- **Scheduled Messages**: Send automated messages via cron jobs or scheduled tasks
- **Admin Broadcasting**: Send administrative messages without connecting as a WebSocket client
- **Testing**: Test multi-server message distribution via Redis

## How It Works

```
External App/Script → Redis Publisher → Redis → WebSocket Servers → Clients in Room
```

The publisher writes messages to Redis using the Socket.IO Redis adapter protocol, and all connected WebSocket servers receive and broadcast these messages to their clients.

## Usage

### Start the Publisher

```bash
# Using npm script
npm run publisher

# Or directly with environment variables
REDIS_HOST=localhost REDIS_PORT=6379 node redis-publisher.js
```

### Available Commands

Once the publisher is running, you have these commands:

```
PUBLISHER> help                              # Show help menu
PUBLISHER> send <roomId> <message>           # Send message to a specific room
PUBLISHER> broadcast <message>               # Broadcast to all connected clients
PUBLISHER> monitor                           # Monitor Redis pub/sub activity
PUBLISHER> keys                              # Show Socket.IO keys in Redis
PUBLISHER> test                              # Test connection and check active servers
PUBLISHER> exit                              # Exit publisher
```

## Examples

### Test Connection First

```bash
PUBLISHER> test
[TEST] Redis connection: PONG
[TEST] Active Socket.IO servers: 1
[SUCCESS] Socket.IO servers are listening!
```

### Send Message to a Room

```bash
PUBLISHER> send game-lobby Welcome to the game!
[PUBLISHED] Room: game-lobby | Message: Welcome to the game!
[CHANNEL] socket.io-request
[SUBSCRIBERS] 1 server(s) received the message
```

All clients in the `game-lobby` room will receive:
```javascript
{
  roomId: "game-lobby",
  from: "REDIS_PUBLISHER",
  message: "Welcome to the game!",
  timestamp: "2025-10-25T12:34:56.789Z"
}
```

### Using Streams Method

```bash
PUBLISHER> stream game-lobby Server maintenance in 5 minutes
[STREAM PUBLISHED] Room: game-lobby | Message: Server maintenance in 5 minutes
[STREAM] socket.io#/#
```

### Monitor Redis Activity

```bash
PUBLISHER> monitor
[MONITOR] Starting Redis pub/sub monitor...
[MONITOR] Press Ctrl+C to stop

[RECEIVED] Channel: socket.io#/#game-lobby#
[MESSAGE] {"type":"room-message","data":{...}}
```

### View Redis Keys

```bash
PUBLISHER> keys
=== Socket.IO Keys in Redis ===
  - socket.io#/#
  - socket.io#/#game-lobby#
================================
```

## Integration Examples

### From Node.js Script

```javascript
const { createClient } = require('redis');

async function sendMessageToRoom(roomId, message) {
  const redisClient = createClient({
    socket: { host: 'localhost', port: 6379 }
  });

  await redisClient.connect();

  const channel = `socket.io#/#${roomId}#`;
  const payload = JSON.stringify([
    null,
    {
      type: 'room-message',
      data: {
        roomId,
        from: 'EXTERNAL_SYSTEM',
        message,
        timestamp: new Date().toISOString()
      }
    },
    {
      rooms: [roomId],
      flags: {}
    }
  ]);

  await redisClient.publish(channel, payload);
  await redisClient.quit();
}

// Usage
sendMessageToRoom('game-lobby', 'Player joined!');
```

### From Python Script

```python
import redis
import json
from datetime import datetime

def send_message_to_room(room_id, message):
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)

    channel = f"socket.io#/#{room_id}#"
    payload = json.dumps([
        None,
        {
            "type": "room-message",
            "data": {
                "roomId": room_id,
                "from": "PYTHON_SCRIPT",
                "message": message,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        },
        {
            "rooms": [room_id],
            "flags": {}
        }
    ])

    r.publish(channel, payload)

# Usage
send_message_to_room('game-lobby', 'System notification')
```

### From Bash/curl (Using Redis CLI)

```bash
# Using redis-cli with Docker
docker exec -it socketio-redis redis-cli PUBLISH \
  'socket.io#/#game-lobby#' \
  '[null,{"type":"room-message","data":{"roomId":"game-lobby","from":"BASH","message":"Hello","timestamp":"2025-10-25T12:00:00Z"}},{"rooms":["game-lobby"],"flags":{}}]'
```

## Pub/Sub vs Streams

### Pub/Sub Method (`publish` command)
- **Best for**: Real-time messages
- **Pros**: Fast, immediate delivery
- **Cons**: Messages not persisted, missed by offline servers

### Streams Method (`stream` command)
- **Best for**: Guaranteed delivery
- **Pros**: Messages persisted in Redis, servers can catch up
- **Cons**: Slightly more overhead

**Recommendation**: Use `publish` for real-time notifications, use `stream` for important messages that must be delivered.

## Testing the Setup

1. **Start Redis:**
   ```bash
   docker start socketio-redis
   ```

2. **Start WebSocket Server:**
   ```bash
   npm run server
   # In server prompt, type: start
   ```

3. **Start a Client (in another terminal):**
   ```bash
   npm run client
   # Join a room: join game-lobby
   ```

4. **Start Publisher (in another terminal):**
   ```bash
   npm run publisher
   ```

5. **Send a message:**
   ```bash
   PUBLISHER> publish game-lobby Hello everyone!
   ```

6. **Verify**: The client should receive the message!

## Troubleshooting

### Messages not received by clients

1. Check that the room name matches exactly
2. Verify clients have joined the room
3. Check Redis connection:
   ```bash
   docker exec -it socketio-redis redis-cli ping
   ```
4. Monitor Redis activity:
   ```bash
   PUBLISHER> monitor
   ```

### Connection errors

- Ensure Redis is running: `docker ps | grep redis`
- Check REDIS_HOST is set to `localhost` (not `redis`)
- Verify port 6379 is accessible

## Advanced: Automated Messages

### Cron Job Example

```bash
# Add to crontab: Send daily message at 9am
0 9 * * * docker exec socketio-redis redis-cli PUBLISH 'socket.io#/#announcements#' '[null,{"type":"room-message","data":{"roomId":"announcements","from":"CRON","message":"Good morning!","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}},{"rooms":["announcements"],"flags":{}}]'
```

### Webhook Integration

```javascript
// Express endpoint to receive webhooks
app.post('/webhook/message', async (req, res) => {
  const { roomId, message } = req.body;

  await redisClient.publish(
    `socket.io#/#${roomId}#`,
    JSON.stringify([null, {
      type: 'room-message',
      data: {
        roomId,
        from: 'WEBHOOK',
        message,
        timestamp: new Date().toISOString()
      }
    }, {
      rooms: [roomId],
      flags: {}
    }])
  );

  res.json({ success: true });
});
```

## Security Considerations

- **Production**: Add authentication to your Redis instance
- **Validation**: Validate room IDs and message content
- **Rate Limiting**: Implement rate limits to prevent abuse
- **Network**: Use Redis password and encrypted connections in production
