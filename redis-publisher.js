const { createClient } = require('redis');
const readline = require('readline');

// Redis configuration
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

let redisClient;

// Create readline interface for CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'PUBLISHER> '
});

async function initializeRedis() {
  try {
    redisClient = createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT
      }
    });

    redisClient.on('error', (err) => {
      console.error('[REDIS ERROR]', err);
    });

    redisClient.on('connect', () => {
      console.log(`[REDIS] Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`);
    });

    await redisClient.connect();
    console.log('[REDIS] Publisher ready\n');
    return true;
  } catch (error) {
    console.error('[REDIS] Failed to connect to Redis:', error.message);
    process.exit(1);
  }
}

async function sendToRoom(roomId, message) {
  const timestamp = new Date().toISOString();

  // Use the external-to-socketio channel
  const channel = 'external-to-socketio';

  const payload = {
    type: 'room-message',
    roomId,
    message,
    from: 'REDIS_PUBLISHER',
    timestamp
  };

  try {
    const subscribers = await redisClient.publish(channel, JSON.stringify(payload));
    console.log(`\n[SENT] Room: ${roomId} | Message: ${message}`);
    console.log(`[SUBSCRIBERS] ${subscribers} server(s) received the message\n`);

    if (subscribers === 0) {
      console.log('[WARNING] No servers are listening! Make sure your WebSocket server is running.\n');
    }
  } catch (error) {
    console.error('[ERROR] Failed to send message:', error.message);
  }
}

async function broadcastToAll(message) {
  const timestamp = new Date().toISOString();
  const channel = 'external-to-socketio';

  const payload = {
    type: 'broadcast',
    message,
    from: 'REDIS_PUBLISHER',
    timestamp
  };

  try {
    const subscribers = await redisClient.publish(channel, JSON.stringify(payload));
    console.log(`\n[BROADCAST] Message: ${message}`);
    console.log(`[SUBSCRIBERS] ${subscribers} server(s) received the message\n`);

    if (subscribers === 0) {
      console.log('[WARNING] No servers are listening! Make sure your WebSocket server is running.\n');
    }
  } catch (error) {
    console.error('[ERROR] Failed to broadcast message:', error.message);
  }
}

async function monitorRedis() {
  console.log('\n[MONITOR] Starting Redis pub/sub monitor...');
  console.log('[MONITOR] Monitoring channel: external-to-socketio');
  console.log('[MONITOR] Press Ctrl+C to stop\n');

  const subscriber = redisClient.duplicate();
  await subscriber.connect();

  await subscriber.subscribe('external-to-socketio', (message, channel) => {
    console.log(`\n[RECEIVED] Channel: ${channel}`);
    try {
      const parsed = JSON.parse(message);
      console.log(`[MESSAGE]`, JSON.stringify(parsed, null, 2));
    } catch {
      console.log(`[MESSAGE] ${message}`);
    }
    console.log('');
  });

  console.log('[MONITOR] Subscribed to channel\n');
  rl.prompt();
}

async function showKeys() {
  try {
    const keys = await redisClient.keys('socket.io*');
    console.log('\n=== Socket.IO Keys in Redis ===');
    if (keys.length === 0) {
      console.log('No Socket.IO keys found');
    } else {
      keys.forEach(key => console.log(`  - ${key}`));
    }
    console.log('================================\n');
  } catch (error) {
    console.error('[ERROR]', error.message);
  }
}

async function testConnection() {
  try {
    const pong = await redisClient.ping();
    console.log(`\n[TEST] Redis connection: ${pong}`);

    // Send a test message to check for subscribers
    const testPayload = {
      type: 'test',
      message: 'Connection test',
      timestamp: new Date().toISOString()
    };

    const subscribers = await redisClient.publish('external-to-socketio', JSON.stringify(testPayload));
    console.log(`[TEST] Active Socket.IO servers: ${subscribers}`);

    if (subscribers === 0) {
      console.log('[WARNING] No Socket.IO servers are listening!');
      console.log('[WARNING] Make sure to:');
      console.log('[WARNING]   1. Start your WebSocket server: npm run server');
      console.log('[WARNING]   2. Type "start" in the server prompt\n');
    } else {
      console.log('[SUCCESS] Socket.IO servers are listening!\n');
    }
  } catch (error) {
    console.error('[ERROR]', error.message);
  }
}

function showHelp() {
  console.log('\n=== Redis Publisher Commands ===');
  console.log('help                        - Show this help menu');
  console.log('send <roomId> <message>     - Send message to a specific room');
  console.log('broadcast <message>         - Broadcast message to all clients');
  console.log('monitor                     - Monitor Redis pub/sub activity');
  console.log('keys                        - Show all Socket.IO keys in Redis');
  console.log('test                        - Test Redis connection and server status');
  console.log('exit                        - Exit the publisher');
  console.log('================================\n');
}

// Handle CLI input
rl.on('line', async (line) => {
  const input = line.trim();
  const [command, ...args] = input.split(' ');

  switch (command.toLowerCase()) {
    case 'help':
      showHelp();
      break;

    case 'send':
      if (args.length < 2) {
        console.log('Usage: send <roomId> <message>');
      } else {
        const roomId = args[0];
        const message = args.slice(1).join(' ');
        await sendToRoom(roomId, message);
      }
      break;

    case 'broadcast':
      if (args.length === 0) {
        console.log('Usage: broadcast <message>');
      } else {
        const message = args.join(' ');
        await broadcastToAll(message);
      }
      break;

    case 'monitor':
      await monitorRedis();
      return; // Don't show prompt

    case 'keys':
      await showKeys();
      break;

    case 'test':
      await testConnection();
      break;

    case 'exit':
      console.log('Shutting down publisher...');
      await redisClient.quit();
      process.exit(0);
      return;

    case '':
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Type "help" for available commands');
  }

  rl.prompt();
});

// Handle Ctrl+C
rl.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT. Shutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

// Initialize
(async () => {
  console.log('\n╔════════════════════════════════════╗');
  console.log('║   Redis Publisher for Socket.IO    ║');
  console.log('╚════════════════════════════════════╝\n');

  await initializeRedis();

  console.log('Type "help" for available commands');
  console.log('Type "test" to check server connection\n');
  rl.prompt();
})();
