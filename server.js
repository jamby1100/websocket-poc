const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-streams-adapter');
const readline = require('readline');
const axios = require('axios');
const { success, error, warning, info, bold, dim, green, red, yellow, cyan, gray,
  doubleBoxTitle, doubleBoxLine, doubleBoxSeparator, doubleBoxBottom,
  boxTitle, boxLine, boxBottom, emoji } = require('./colors');

// Create Express app
const app = express();
const server = http.createServer(app);

// Redis configuration from environment variables
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const SERVER_ID = process.env.SERVER_ID || `server-${Math.random().toString(36).substring(7)}`;

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Enable connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Initialize Redis client for adapter
let redisClient;
let subscriberClient;

// Set up external message listener for redis-publisher
async function setupExternalMessageListener() {
  try {
    // Create a separate subscriber client
    subscriberClient = redisClient.duplicate();
    await subscriberClient.connect();

    // Subscribe to external messages channel
    await subscriberClient.subscribe('external-to-socketio', (message) => {
      try {
        const data = JSON.parse(message);
        const { type, roomId, message: msg, from, timestamp } = data;

        if (type === 'room-message' && roomId) {
          // Emit to specific room
          io.to(roomId).emit('room-message', {
            roomId,
            from: from || 'EXTERNAL',
            message: msg,
            timestamp: timestamp || new Date().toISOString()
          });
          console.log(`\n[EXTERNAL] Message sent to room "${roomId}": ${msg}`);
          if (rl) rl.prompt();
        } else if (type === 'broadcast') {
          // Broadcast to all clients
          io.emit('server-broadcast', {
            message: msg,
            timestamp: timestamp || new Date().toISOString()
          });
          console.log(`\n[EXTERNAL] Broadcast: ${msg}`);
          if (rl) rl.prompt();
        }
      } catch (error) {
        console.error('[EXTERNAL] Error processing message:', error.message);
      }
    });

    console.log('[REDIS] External message listener initialized');
  } catch (error) {
    console.error('[REDIS] Failed to set up external message listener:', error.message);
  }
}

async function initializeRedis() {
  try {
    redisClient = createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        tls: process.env.REDIS_TLS === 'true' ? true : false,
        rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    });

    redisClient.on('error', (err) => {
      console.error('\n[REDIS ERROR]', err);
      console.log(`\n[REDIS] Error Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT} TLS: ${process.REDIS_TLS}`);
    });

    redisClient.on('connect', () => {
      console.log(`\n[REDIS] Connected to Redis at ${REDIS_HOST}:${REDIS_PORT} TLS: ${process.REDIS_TLS}`);
    });

    redisClient.on('ready', () => {
      console.log('[REDIS] Redis client is ready');
    });

    redisClient.on('reconnecting', () => {
      console.log('[REDIS] Reconnecting to Redis...');
      console.log(`\n[REDIS] Reconnecting to Redis at ${REDIS_HOST}:${REDIS_PORT} TLS: ${process.REDIS_TLS}`);
    });

    await redisClient.connect();

    // Set up Redis Streams adapter
    io.adapter(createAdapter(redisClient));
    console.log(`[REDIS] Redis Streams adapter initialized for ${SERVER_ID}`);

    // Set up subscriber for external messages (from redis-publisher)
    await setupExternalMessageListener();

    return true;
  } catch (error) {
    console.error('\n[REDIS] Failed to connect to Redis:', error.message);
    console.log('[REDIS] Running in standalone mode without Redis');
    return false;
  }
}

// Store active rooms and clients
const rooms = new Map();
const clients = new Map();

// Store online drivers and riders by their names
const onlineDrivers = new Map(); // "John Doe" → socketId
const onlineRiders = new Map();  // "Jane Smith" → socketId
const userSockets = new Map();   // socketId → { type: 'driver'/'rider', userData: {...}, location: {...} }
const tripToRider = new Map();   // tripId → riderSocketId

// Action router for external API calls
const API_BASE_URL = process.env.API_BASE_URL || 'http://joyride-rewrite-alb-1006628052.ap-southeast-2.elb.amazonaws.com';

const actionRouter = {
  'create_trip': {
    method: 'POST',
    endpoint: '/trips'
  },
  'cancel_trip': {
    method: 'DELETE',
    endpoint: '/trips'
  },
  'complete_trip': {
    method: 'PUT',
    endpoint: '/trips'
  }
};

// Create readline interface for server CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'SERVER> '
});

let serverRunning = false;

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Check if this is a recovered connection
  const recovered = socket.recovered;

  if (recovered) {
    console.log(`\n[RECOVERY] Client reconnected (recovered): ${socket.id}`);
  } else {
    console.log(`\n[CONNECT] Client connected: ${socket.id}`);
  }

  clients.set(socket.id, { socket, rooms: new Set() });
  rl.prompt();

  // Handle assume identity (driver or rider)
  socket.on('assume-identity', ({ userType, userData, location }) => {
    const fullName = `${userData.firstName} ${userData.lastName}`;

    if (userType === 'driver') {
      onlineDrivers.set(fullName, socket.id);
      userSockets.set(socket.id, {
        type: 'driver',
        userData,
        location: location || null
      });
      console.log(`\n[DRIVER ONLINE] ${fullName} (${socket.id})`);
    } else if (userType === 'rider') {
      onlineRiders.set(fullName, socket.id);
      userSockets.set(socket.id, {
        type: 'rider',
        userData,
        location: location || null
      });
      console.log(`\n[RIDER ONLINE] ${fullName} (${socket.id})`);
    }

    rl.prompt();
  });

  // Handle location update
  socket.on('update-location', ({ location }) => {
    if (userSockets.has(socket.id)) {
      const userData = userSockets.get(socket.id);
      userData.location = location;
      userSockets.set(socket.id, userData);
      console.log(`\n[LOCATION UPDATE] ${socket.id} location updated`);
      rl.prompt();
    }
  });

  // Handle trip request from rider
  socket.on('trip-request', async (payload) => {
    console.log(`\n[TRIP REQUEST] Received from ${socket.id}`);
    console.log(`[TRIP REQUEST] Action: ${payload.action}`);

    const action = actionRouter[payload.action];

    if (!action) {
      console.log(`[ERROR] Unknown action: ${payload.action}`);
      socket.emit('trip-error', { message: 'Unknown action' });
      rl.prompt();
      return;
    }

    try {
      // Call external API
      const apiUrl = `${API_BASE_URL}${action.endpoint}`;
      console.log(`[API CALL] ${action.method} ${apiUrl}`);
      const response = await axios({
        method: action.method,
        url: apiUrl,
        data: payload.data,
        headers: payload.header || {},
        timeout: 30000
      });
      
      console.log('[DATA]', JSON.stringify(payload.data, null, 2))
      console.log(`[API RESPONSE] Status: ${response.status}`);

      if (response.data && response.data.data) {
        const tripData = response.data.data;

        // Store mapping of tripId to rider socketId
        tripToRider.set(tripData.sk, socket.id);
        const driverSocketId = null;
        
        const driverFullName = ``;
        // Extract driver info from API response
        if (tripData.driver) {
          const driverFirstName = tripData.driver.firstName;
          const driverLastName = tripData.driver.lastName;
          const driverFullName = `${driverFirstName} ${driverLastName}`;
          console.log(`[DRIVER ASSIGNMENT] Driver assigned: ${driverFullName}`);

          // Look up driver socket by name
          const driverSocketId = onlineDrivers.get(driverFullName);
        } else {
          console.log("No Driver assigned")
        }


        

        // Send trip details back to rider (with fare, without driver details yet)
        socket.emit('trip-created', {
          tripId: tripData.sk,
          rider: tripData.rider,
          fare: tripData.fare,
          metrics: tripData.metrics,
          driver: tripData.driver
        });



        if (driverSocketId && tripData.driver) {
          console.log(`[DRIVER NOTIFICATION] Notifying driver ${driverFullName} (${driverSocketId})`);

          // Send trip request to the assigned driver
          io.to(driverSocketId).emit('trip-request-notification', {
            tripId: tripData.sk,
            rider: tripData.rider,
            fare: tripData.fare,
            driver: tripData.driver
          });
        } else {
          console.log(`[ERROR] Driver ${driverFullName ? driverFullName : "[Driver]"} is not online or not found`);
          console.log(`[ERROR] Available drivers: ${Array.from(onlineDrivers.keys()).join(', ')}`);
        }
      } else {
        console.log(`[ERROR] Invalid API response format`);
        socket.emit('trip-error', { message: 'Invalid API response' });
      }

    } catch (error) {
      console.log(`\n[ERROR] API call failed: ${error.message}`);
      console.log(dim('Stack trace:'));
      console.log(dim(error.stack) + '\n');

      if (error.response) {
        console.log(`[ERROR] Status: ${error.response.status}`);
        console.log(`[ERROR] Data:`, error.response.data);
      }

      socket.emit('trip-error', {
        message: `Booking failed: ${error.message}`
      });
    }

    rl.prompt();
  });

  // Handle driver response (accept/reject)
  socket.on('driver-response', ({ tripId, driverName, accepted }) => {
    console.log(`\n[DRIVER RESPONSE] Trip ${tripId} | Driver: ${driverName} | Accepted: ${accepted}`);

    // Get the rider who made this trip request
    const riderSocketId = tripToRider.get(tripId);

    if (!riderSocketId) {
      console.log(`[ERROR] No rider found for trip ${tripId}`);
      rl.prompt();
      return;
    }

    if (accepted) {
      // Notify the specific rider about acceptance
      io.to(riderSocketId).emit('driver-accepted', {
        tripId,
        driverName
      });
      console.log(`[NOTIFICATION] Rider ${riderSocketId} notified of acceptance`);

      // Clean up the mapping after acceptance
      tripToRider.delete(tripId);
    } else {
      // Notify the specific rider about rejection
      io.to(riderSocketId).emit('driver-rejected', {
        tripId,
        driverName
      });
      console.log(`[NOTIFICATION] Rider ${riderSocketId} notified of rejection`);

      // Keep the mapping in case another driver is assigned
    }

    rl.prompt();
  });

  // Handle room join
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    
    // Track room membership
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);
    
    // Track client's rooms
    if (clients.has(socket.id)) {
      clients.get(socket.id).rooms.add(roomId);
    }
    
    console.log(`\n[ROOM JOIN] Client ${socket.id} joined room: ${roomId}`);
    console.log(`[ROOM INFO] Room ${roomId} now has ${rooms.get(roomId).size} members`);
    
    // Notify the client
    socket.emit('room-joined', { roomId, message: `Successfully joined room: ${roomId}` });
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', { 
      userId: socket.id, 
      roomId,
      message: `User ${socket.id} joined the room` 
    });
    
    rl.prompt();
  });

  // Handle room leave
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    
    // Update tracking
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      }
    }
    
    if (clients.has(socket.id)) {
      clients.get(socket.id).rooms.delete(roomId);
    }
    
    console.log(`\n[ROOM LEAVE] Client ${socket.id} left room: ${roomId}`);
    
    // Notify others in the room
    socket.to(roomId).emit('user-left', { 
      userId: socket.id, 
      roomId,
      message: `User ${socket.id} left the room` 
    });
    
    rl.prompt();
  });

  // Handle room messages
  socket.on('room-message', ({ roomId, message }) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[MESSAGE] Room: ${roomId} | From: ${socket.id} | Message: ${message}`);
    
    // Broadcast to all clients in the room (including sender)
    io.to(roomId).emit('room-message', {
      roomId,
      from: socket.id,
      message,
      timestamp
    });
    
    rl.prompt();
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`\n[DISCONNECT] Client disconnected: ${socket.id}`);

    // Clean up driver/rider tracking
    if (userSockets.has(socket.id)) {
      const user = userSockets.get(socket.id);
      const fullName = `${user.userData.firstName} ${user.userData.lastName}`;

      if (user.type === 'driver') {
        onlineDrivers.delete(fullName);
        console.log(`[DRIVER OFFLINE] ${fullName}`);
      } else if (user.type === 'rider') {
        onlineRiders.delete(fullName);
        console.log(`[RIDER OFFLINE] ${fullName}`);
      }

      userSockets.delete(socket.id);
    }

    // Clean up room memberships
    if (clients.has(socket.id)) {
      const clientRooms = clients.get(socket.id).rooms;
      clientRooms.forEach(roomId => {
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(socket.id);
          if (rooms.get(roomId).size === 0) {
            rooms.delete(roomId);
            console.log(`[ROOM INFO] Room ${roomId} is now empty and removed`);
          }
        }
        
        // Notify others in the room
        socket.to(roomId).emit('user-left', { 
          userId: socket.id, 
          roomId,
          message: `User ${socket.id} disconnected` 
        });
      });
      clients.delete(socket.id);
    }
    
    rl.prompt();
  });
});

// Server CLI commands
function showHelp() {
  console.log('\n=== Server Commands ===');
  console.log('help                     - Show this help menu');
  console.log('start                    - Start the server');
  console.log('stop                     - Stop the server');
  console.log('status                   - Show server status');
  console.log('rooms                    - List all active rooms');
  console.log('clients                  - List all connected clients');
  console.log('room <roomId>            - Show clients in a specific room');
  console.log('broadcast <message>      - Broadcast message to all clients');
  console.log('sendroom <roomId> <msg>  - Send message to a specific room');
  console.log('exit                     - Exit the server');
  console.log('========================\n');
}

function showStatus() {
  console.log('\n=== Server Status ===');
  console.log(`Running: ${serverRunning}`);
  console.log(`Port: 3000`);
  console.log(`Connected Clients: ${clients.size}`);
  console.log(`Active Rooms: ${rooms.size}`);
  console.log('=====================\n');
}

function listRooms() {
  console.log('\n=== Active Rooms ===');
  if (rooms.size === 0) {
    console.log('No active rooms');
  } else {
    rooms.forEach((members, roomId) => {
      console.log(`Room: ${roomId} - Members: ${members.size}`);
    });
  }
  console.log('====================\n');
}

function listClients() {
  console.log('\n=== Connected Clients ===');
  if (clients.size === 0) {
    console.log('No connected clients');
  } else {
    clients.forEach((client, socketId) => {
      const roomList = Array.from(client.rooms).join(', ') || 'none';
      console.log(`Client: ${socketId} - Rooms: ${roomList}`);
    });
  }
  console.log('=========================\n');
}

function showRoom(roomId) {
  console.log(`\n=== Room: ${roomId} ===`);
  if (!rooms.has(roomId)) {
    console.log('Room not found or empty');
  } else {
    const members = rooms.get(roomId);
    console.log(`Members (${members.size}):`);
    members.forEach(memberId => {
      console.log(`  - ${memberId}`);
    });
  }
  console.log('====================\n');
}

function broadcastMessage(message) {
  if (!serverRunning) {
    console.log('Server is not running!');
    return;
  }
  
  io.emit('server-broadcast', {
    message,
    timestamp: new Date().toISOString()
  });
  console.log(`Broadcast sent: ${message}\n`);
}

function sendToRoom(roomId, message) {
  if (!serverRunning) {
    console.log('Server is not running!');
    return;
  }

  const timestamp = new Date().toISOString();
  io.to(roomId).emit('room-message', {
    roomId,
    from: 'SERVER',
    message,
    timestamp
  });

  // Show warning if room is empty, but still send the message
  const memberCount = rooms.has(roomId) ? rooms.get(roomId).size : 0;
  if (memberCount === 0) {
    console.log(`\n[SENT TO ROOM] Room: ${roomId} | Message: ${message} | Warning: Room is empty (0 members)\n`);
  } else {
    console.log(`\n[SENT TO ROOM] Room: ${roomId} | Message: ${message} | Members: ${memberCount}\n`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const autoStart = args.includes('--auto-start');

// Handle CLI input
rl.on('line', (line) => {
  const input = line.trim();
  const [command, ...args] = input.split(' ');

  switch (command.toLowerCase()) {
    case 'help':
      showHelp();
      break;
      
    case 'start':
      if (serverRunning) {
        console.log('Server is already running!');
      } else {
        (async () => {
          // Initialize Redis before starting server
          await initializeRedis();

          server.listen(3000, () => {
            serverRunning = true;
            console.log(`\n✓ Socket.IO server started on http://localhost:3000`);
            console.log(`✓ Server ID: ${SERVER_ID}`);
            console.log('Type "help" for available commands\n');
            rl.prompt();
          });
        })();
      }
      break;
      
    case 'stop':
      if (!serverRunning) {
        console.log('Server is not running!');
      } else {
        server.close(async () => {
          serverRunning = false;
          if (subscriberClient) {
            await subscriberClient.quit();
          }
          if (redisClient) {
            await redisClient.quit();
            console.log('[REDIS] Disconnected from Redis');
          }
          console.log('\n✓ Server stopped\n');
          rl.prompt();
        });
      }
      break;
      
    case 'status':
      showStatus();
      break;
      
    case 'rooms':
      listRooms();
      break;
      
    case 'clients':
      listClients();
      break;
      
    case 'room':
      if (args.length === 0) {
        console.log('Usage: room <roomId>');
      } else {
        showRoom(args[0]);
      }
      break;
      
    case 'broadcast':
      if (args.length === 0) {
        console.log('Usage: broadcast <message>');
      } else {
        broadcastMessage(args.join(' '));
      }
      break;
      
    case 'sendroom':
      if (args.length < 2) {
        console.log('Usage: sendroom <roomId> <message>');
      } else {
        const roomId = args[0];
        const message = args.slice(1).join(' ');
        sendToRoom(roomId, message);
      }
      break;
      
    case 'exit':
      console.log('Shutting down server...');
      if (serverRunning) {
        server.close(async () => {
          if (subscriberClient) {
            await subscriberClient.quit();
          }
          if (redisClient) {
            await redisClient.quit();
            console.log('[REDIS] Disconnected from Redis');
          }
          process.exit(0);
        });
      } else {
        (async () => {
          if (subscriberClient) {
            await subscriberClient.quit();
          }
          if (redisClient) {
            await redisClient.quit();
          }
          process.exit(0);
        })();
      }
      return;
      
    case '':
      break;
      
    default:
      console.log(`Unknown command: ${command}`);
      console.log('Type "help" for available commands');
  }
  
  rl.prompt();
});

// Initial prompt
console.log('\n╔════════════════════════════════════╗');
console.log('║   Socket.IO CLI Server             ║');
console.log('╚════════════════════════════════════╝');

// Auto-start if flag is provided
if (autoStart) {
  console.log('\n[AUTO-START] Starting server automatically...\n');
  (async () => {
    await initializeRedis();

    server.listen(3000, () => {
      serverRunning = true;
      console.log(`\n✓ Socket.IO server started on http://localhost:3000`);
      console.log(`✓ Server ID: ${SERVER_ID}`);
      console.log('Type "help" for available commands\n');
      rl.prompt();
    });
  })();
} else {
  console.log('\nType "start" to start the server');
  console.log('Type "help" for available commands\n');
  rl.prompt();
}

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT. Shutting down gracefully...');
  if (serverRunning) {
    server.close(async () => {
      if (subscriberClient) {
        await subscriberClient.quit();
      }
      if (redisClient) {
        await redisClient.quit();
        console.log('[REDIS] Disconnected from Redis');
      }
      process.exit(0);
    });
  } else {
    (async () => {
      if (subscriberClient) {
        await subscriberClient.quit();
      }
      if (redisClient) {
        await redisClient.quit();
      }
      process.exit(0);
    })();
  }
});