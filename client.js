const io = require('socket.io-client');
const readline = require('readline');

// Client state
let socket = null;
let connected = false;
let currentRoom = null;
let mySocketId = null;

// Create readline interface for client CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'CLIENT> '
});

// Socket event handlers
function setupSocketListeners() {
  socket.on('connect', () => {
    connected = true;
    mySocketId = socket.id;
    console.log(`\n✓ Connected to server! Your ID: ${socket.id}\n`);
    rl.prompt();
  });

  socket.on('disconnect', () => {
    connected = false;
    currentRoom = null;
    console.log('\n✗ Disconnected from server\n');
    rl.prompt();
  });

  socket.on('room-joined', ({ roomId, message }) => {
    currentRoom = roomId;
    console.log(`\n✓ ${message}`);
    console.log(`You can now send messages to room: ${roomId}`);
    console.log('Use "send <message>" to send a message\n');
    rl.prompt();
  });

  socket.on('user-joined', ({ userId, roomId, message }) => {
    if (currentRoom === roomId) {
      console.log(`\n[ROOM] ${message}\n`);
      rl.prompt();
    }
  });

  socket.on('user-left', ({ userId, roomId, message }) => {
    if (currentRoom === roomId) {
      console.log(`\n[ROOM] ${message}\n`);
      rl.prompt();
    }
  });

  socket.on('room-message', ({ roomId, from, message, timestamp }) => {
    if (currentRoom === roomId) {
      const time = new Date(timestamp).toLocaleTimeString();
      const fromLabel = from === mySocketId ? 'You' : from;
      console.log(`\n[${time}] ${fromLabel}: ${message}\n`);
      rl.prompt();
    }
  });

  socket.on('server-broadcast', ({ message, timestamp }) => {
    const time = new Date(timestamp).toLocaleTimeString();
    console.log(`\n[SERVER BROADCAST ${time}] ${message}\n`);
    rl.prompt();
  });

  socket.on('connect_error', (error) => {
    console.log(`\n✗ Connection error: ${error.message}\n`);
    rl.prompt();
  });
}

// CLI commands
function showHelp() {
  console.log('\n=== Client Commands ===');
  console.log('help              - Show this help menu');
  console.log('connect           - Connect to the server');
  console.log('disconnect        - Disconnect from the server');
  console.log('join <roomId>     - Join a room');
  console.log('leave             - Leave current room');
  console.log('send <message>    - Send message to current room');
  console.log('status            - Show connection status');
  console.log('exit              - Exit the client');
  console.log('========================\n');
}

function connectToServer() {
  if (connected) {
    console.log('Already connected to server!');
    return;
  }

  console.log('Connecting to server at http://localhost:3000...');
  socket = io('http://localhost:3000', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
  
  setupSocketListeners();
}

function disconnectFromServer() {
  if (!connected) {
    console.log('Not connected to server!');
    return;
  }

  socket.disconnect();
  socket = null;
  connected = false;
  currentRoom = null;
  console.log('Disconnected from server');
}

function joinRoom(roomId) {
  if (!connected) {
    console.log('Error: Not connected to server! Use "connect" first.');
    return;
  }

  if (!roomId) {
    console.log('Error: Please specify a room ID');
    console.log('Usage: join <roomId>');
    return;
  }

  if (currentRoom) {
    console.log(`Leaving current room: ${currentRoom}`);
    socket.emit('leave-room', currentRoom);
  }

  console.log(`Joining room: ${roomId}...`);
  socket.emit('join-room', roomId);
}

function leaveRoom() {
  if (!connected) {
    console.log('Error: Not connected to server!');
    return;
  }

  if (!currentRoom) {
    console.log('Error: Not in any room!');
    return;
  }

  console.log(`Leaving room: ${currentRoom}...`);
  socket.emit('leave-room', currentRoom);
  currentRoom = null;
  console.log('Left the room');
}

function sendMessage(message) {
  if (!connected) {
    console.log('Error: Not connected to server!');
    return;
  }

  if (!currentRoom) {
    console.log('Error: Not in any room! Use "join <roomId>" first.');
    return;
  }

  if (!message) {
    console.log('Error: Please provide a message');
    console.log('Usage: send <message>');
    return;
  }

  socket.emit('room-message', {
    roomId: currentRoom,
    message: message
  });
}

function showStatus() {
  console.log('\n=== Client Status ===');
  console.log(`Connected: ${connected}`);
  console.log(`Socket ID: ${mySocketId || 'N/A'}`);
  console.log(`Current Room: ${currentRoom || 'None'}`);
  console.log(`Server URL: http://localhost:3000`);
  console.log('=====================\n');
}

// Handle CLI input
rl.on('line', (line) => {
  const input = line.trim();
  const [command, ...args] = input.split(' ');

  switch (command.toLowerCase()) {
    case 'help':
      showHelp();
      break;

    case 'connect':
      connectToServer();
      break;

    case 'disconnect':
      disconnectFromServer();
      break;

    case 'join':
      joinRoom(args[0]);
      break;

    case 'leave':
      leaveRoom();
      break;

    case 'send':
      sendMessage(args.join(' '));
      break;

    case 'status':
      showStatus();
      break;

    case 'exit':
      console.log('Exiting client...');
      if (connected) {
        socket.disconnect();
      }
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

// Initial prompt
console.log('\n╔════════════════════════════════════╗');
console.log('║   Socket.IO CLI Client             ║');
console.log('╚════════════════════════════════════╝');
console.log('\nType "connect" to connect to the server');
console.log('Type "help" for available commands\n');
rl.prompt();

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT. Shutting down...');
  if (connected && socket) {
    socket.disconnect();
  }
  process.exit(0);
});