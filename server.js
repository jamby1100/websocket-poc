const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const readline = require('readline');

// Create Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active rooms and clients
const rooms = new Map();
const clients = new Map();

// Create readline interface for server CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'SERVER> '
});

let serverRunning = false;

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`\n[CONNECT] Client connected: ${socket.id}`);
  clients.set(socket.id, { socket, rooms: new Set() });
  rl.prompt();

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
  
  if (!rooms.has(roomId)) {
    console.log(`Error: Room "${roomId}" does not exist or is empty`);
    return;
  }
  
  const timestamp = new Date().toISOString();
  io.to(roomId).emit('room-message', {
    roomId,
    from: 'SERVER',
    message,
    timestamp
  });
  
  console.log(`\n[SENT TO ROOM] Room: ${roomId} | Message: ${message}\n`);
}

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
        server.listen(3000, () => {
          serverRunning = true;
          console.log('\n✓ Socket.IO server started on http://localhost:3000');
          console.log('Type "help" for available commands\n');
        });
      }
      break;
      
    case 'stop':
      if (!serverRunning) {
        console.log('Server is not running!');
      } else {
        server.close(() => {
          serverRunning = false;
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
        server.close(() => {
          process.exit(0);
        });
      } else {
        process.exit(0);
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
console.log('\nType "start" to start the server');
console.log('Type "help" for available commands\n');
rl.prompt();

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT. Shutting down gracefully...');
  if (serverRunning) {
    server.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});