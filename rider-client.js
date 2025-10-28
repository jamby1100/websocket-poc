const io = require('socket.io-client');
const readline = require('readline');
const { getRiders, getDrivers, getLocations, getRiderByName, getLocationByName } = require('./mock-data');

// Server configuration
const SERVER_HOST = process.env.WEBSOCKET_SERVER || 'localhost';
const SERVER_PORT = process.env.WEBSOCKET_PORT || '3000';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// Client state
let socket = null;
let connected = false;
let currentRider = null;
let currentLocation = null;
let mySocketId = null;
let lookingForDriversInterval = null;
let pendingTripId = null;

// Create readline interface for client CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'RIDER> '
});

// Socket event handlers
function setupSocketListeners() {
  socket.on('connect', () => {
    connected = true;
    mySocketId = socket.id;
    console.log(`\n✓ Connected to server! Your ID: ${socket.id}\n`);

    // If already assumed identity, re-register
    if (currentRider) {
      socket.emit('assume-identity', {
        userType: 'rider',
        userData: currentRider
      });
    }

    rl.prompt();
  });

  socket.on('disconnect', () => {
    connected = false;
    console.log('\n✗ Disconnected from server\n');
    stopLookingForDrivers();
    rl.prompt();
  });

  socket.on('trip-created', (data) => {
    stopLookingForDrivers();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✓ TRIP REQUEST SENT!                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Trip ID: ${data.tripId}`);

    console.log(`\n─── TRIP DETAILS ───`);
    console.log(`Pickup: ${data.rider.location.source.title}`);
    console.log(`       ${data.rider.location.source.fullAddress}`);

    console.log(`\nDestination: ${data.rider.location.destination.title}`);
    console.log(`            ${data.rider.location.destination.fullAddress}`);

    console.log(`\n─── FARE ───`);
    console.log(`TOTAL: ₱${data.fare.total.toFixed(2)}`);

    console.log('\n⏳ Waiting for driver to accept...\n');

    pendingTripId = data.tripId;
    rl.prompt();
  });

  socket.on('trip-error', (data) => {
    stopLookingForDrivers();
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✗ BOOKING CANCELLED                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`Error: ${data.message}\n`);
    pendingTripId = null;
    rl.prompt();
  });

  socket.on('driver-accepted', (data) => {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✓ DRIVER ACCEPTED YOUR TRIP!                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`🚗 Driver: ${data.driverName}`);
    console.log(`Trip ID: ${data.tripId}\n`);
    pendingTripId = null;
    rl.prompt();
  });

  socket.on('driver-rejected', (data) => {
    console.log(`\n✗ Driver ${data.driverName} declined your trip.`);
    console.log(`Trip ID: ${data.tripId}`);
    console.log(`🔄 The system should assign another driver...\n`);
    rl.prompt();
  });

  socket.on('connect_error', (error) => {
    console.log(`\n✗ Connection error: ${error.message}\n`);
    rl.prompt();
  });
}

// Start looking for drivers animation
function startLookingForDrivers() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  lookingForDriversInterval = setInterval(() => {
    process.stdout.write(`\r${frames[i]} Looking for drivers...`);
    i = (i + 1) % frames.length;
  }, 80);
}

function stopLookingForDrivers() {
  if (lookingForDriversInterval) {
    clearInterval(lookingForDriversInterval);
    lookingForDriversInterval = null;
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }
}

// CLI commands
function showHelp() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    RIDER CLIENT COMMANDS                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('  help                              - Show this help menu');
  console.log('  connect                           - Connect to the server');
  console.log('  disconnect                        - Disconnect from server');
  console.log('  display_riders                    - Show all available riders');
  console.log('  display_drivers                   - Show all available drivers');
  console.log('  display_locations                 - Show all available locations');
  console.log('  assume_rider "{name}"             - Assume rider identity');
  console.log('  assume_location "{location}"      - Set current location');
  console.log('  book_trip "{source}" "{dest}"     - Book a trip');
  console.log('  status                            - Show current status');
  console.log('  exit                              - Exit the client');
  console.log('════════════════════════════════════════════════════════════════\n');
}

function displayRiders() {
  const riders = getRiders();
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AVAILABLE RIDERS                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  riders.forEach(rider => {
    console.log(`  ${rider.name}`);
    console.log(`    User ID: ${rider.userId}`);
    console.log(`    First Name: ${rider.firstName}`);
    console.log(`    Last Name: ${rider.lastName}`);
    console.log('');
  });
  console.log('════════════════════════════════════════════════════════════════\n');
}

function displayDrivers() {
  const drivers = getDrivers();
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AVAILABLE DRIVERS                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  drivers.forEach(driver => {
    console.log(`  ${driver.name}`);
    console.log(`    User ID: ${driver.userId}`);
    console.log(`    First Name: ${driver.firstName}`);
    console.log(`    Last Name: ${driver.lastName}`);
    console.log('');
  });
  console.log('════════════════════════════════════════════════════════════════\n');
}

function displayLocations() {
  const locations = getLocations();
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AVAILABLE LOCATIONS                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  locations.forEach(loc => {
    console.log(`  ${loc.name}`);
    console.log(`    Title: ${loc.title}`);
    console.log(`    Address: ${loc.fullAddress}`);
    console.log(`    Coordinates: (${loc.latitude}, ${loc.longitude})`);
    console.log(`    Place ID: ${loc.place_id}`);
    console.log('');
  });
  console.log('════════════════════════════════════════════════════════════════\n');
}

function connectToServer() {
  if (connected) {
    console.log('Already connected to server!');
    return;
  }

  console.log(`Connecting to server at ${SERVER_URL}...`);
  socket = io(SERVER_URL, {
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

  stopLookingForDrivers();
  socket.disconnect();
  socket = null;
  connected = false;
  console.log('Disconnected from server');
}

function assumeRider(name) {
  if (!name) {
    console.log('Error: Please specify a rider name');
    console.log('Usage: assume_rider "{name}"');
    console.log('Example: assume_rider "Jane Smith"');
    return;
  }

  const rider = getRiderByName(name);
  if (!rider) {
    console.log(`Error: Rider "${name}" not found`);
    console.log('Use display_riders to see available riders');
    return;
  }

  currentRider = rider;
  console.log(`\n✓ You are now: ${rider.firstName} ${rider.lastName}`);
  console.log(`  User ID: ${rider.userId}\n`);

  // Register with server if connected
  if (connected && socket) {
    socket.emit('assume-identity', {
      userType: 'rider',
      userData: rider
    });
  }
}

function assumeLocation(locationName) {
  if (!currentRider) {
    console.log('Error: Please assume a rider identity first');
    console.log('Use: assume_rider "{name}"');
    return;
  }

  if (!locationName) {
    console.log('Error: Please specify a location name');
    console.log('Usage: assume_location "{location}"');
    console.log('Example: assume_location "BGC"');
    return;
  }

  const location = getLocationByName(locationName);
  if (!location) {
    console.log(`Error: Location "${locationName}" not found`);
    console.log('Use display_locations to see available locations');
    return;
  }

  currentLocation = location;
  console.log(`\n✓ Current location set to: ${location.title}`);
  console.log(`  Address: ${location.fullAddress}`);
  console.log(`  Coordinates: (${location.latitude}, ${location.longitude})\n`);
}

function bookTrip(source, destination) {
  if (!connected) {
    console.log('Error: Not connected to server! Use "connect" first.');
    return;
  }

  if (!currentRider) {
    console.log('Error: Please assume a rider identity first');
    console.log('Use: assume_rider "{name}"');
    return;
  }

  if (!source || !destination) {
    console.log('Error: Please specify both source and destination');
    console.log('Usage: book_trip "{source}" "{destination}"');
    console.log('Example: book_trip "BGC" "Makati CBD"');
    return;
  }

  const sourceLocation = getLocationByName(source);
  const destLocation = getLocationByName(destination);

  if (!sourceLocation) {
    console.log(`Error: Source location "${source}" not found`);
    console.log('Use display_locations to see available locations');
    return;
  }

  if (!destLocation) {
    console.log(`Error: Destination location "${destination}" not found`);
    console.log('Use display_locations to see available locations');
    return;
  }

  console.log('\n📍 Booking trip...');
  console.log(`   From: ${sourceLocation.title}`);
  console.log(`   To: ${destLocation.title}\n`);

  // Build the request payload
  const requestPayload = {
    action: 'create_trip',
    header: {},
    data: {
      rider: {
        location: {
          source: {
            latitude: sourceLocation.latitude,
            longitude: sourceLocation.longitude,
            place_id: sourceLocation.place_id,
            title: sourceLocation.title,
            fullAddress: sourceLocation.fullAddress
          },
          destination: {
            latitude: destLocation.latitude,
            longitude: destLocation.longitude,
            place_id: destLocation.place_id,
            title: destLocation.title,
            fullAddress: destLocation.fullAddress
          }
        },
        lastName: currentRider.lastName,
        userId: currentRider.userId,
        firstName: currentRider.firstName
      }
    }
  };

  // Start looking for drivers animation
  startLookingForDrivers();

  // Send to server
  socket.emit('trip-request', requestPayload);
}

function showStatus() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      RIDER STATUS                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Connected: ${connected ? '✓ Yes' : '✗ No'}`);
  console.log(`  Socket ID: ${mySocketId || 'N/A'}`);
  console.log(`  Server URL: ${SERVER_URL}`);
  console.log('');

  if (currentRider) {
    console.log(`  Rider Identity: ${currentRider.firstName} ${currentRider.lastName}`);
    console.log(`  User ID: ${currentRider.userId}`);
  } else {
    console.log(`  Rider Identity: Not assumed`);
  }
  console.log('');

  if (currentLocation) {
    console.log(`  Current Location: ${currentLocation.title}`);
    console.log(`  Address: ${currentLocation.fullAddress}`);
    console.log(`  Coordinates: (${currentLocation.latitude}, ${currentLocation.longitude})`);
  } else {
    console.log(`  Current Location: Not set`);
  }

  console.log('════════════════════════════════════════════════════════════════\n');
}

// Handle CLI input
rl.on('line', (line) => {
  const input = line.trim();

  // Parse command with quoted arguments
  const matches = input.match(/(\w+)(?:\s+"([^"]+)")?(?:\s+"([^"]+)")?/);

  if (!matches) {
    if (input !== '') {
      console.log('Invalid command format');
      console.log('Type "help" for available commands');
    }
    rl.prompt();
    return;
  }

  const command = matches[1].toLowerCase();
  const arg1 = matches[2];
  const arg2 = matches[3];

  switch (command) {
    case 'help':
      showHelp();
      break;

    case 'connect':
      connectToServer();
      break;

    case 'disconnect':
      disconnectFromServer();
      break;

    case 'display_riders':
      displayRiders();
      break;

    case 'display_drivers':
      displayDrivers();
      break;

    case 'display_locations':
      displayLocations();
      break;

    case 'assume_rider':
      assumeRider(arg1);
      break;

    case 'assume_location':
      assumeLocation(arg1);
      break;

    case 'book_trip':
      bookTrip(arg1, arg2);
      break;

    case 'status':
      showStatus();
      break;

    case 'exit':
      console.log('Exiting rider client...');
      stopLookingForDrivers();
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
console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║              JOYRIDE RIDER CLIENT                          ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('\nType "connect" to connect to the server');
console.log('Type "help" for available commands\n');
rl.prompt();

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT. Shutting down...');
  stopLookingForDrivers();
  if (connected && socket) {
    socket.disconnect();
  }
  process.exit(0);
});
