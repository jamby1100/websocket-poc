const io = require('socket.io-client');
const readline = require('readline');
const { getRiders, getDrivers, getLocations, getDriverByName, getLocationByName } = require('./mock-data');

// Server configuration
const SERVER_HOST = process.env.WEBSOCKET_SERVER || 'localhost';
const SERVER_PORT = process.env.WEBSOCKET_PORT || '3000';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// Client state
let socket = null;
let connected = false;
let currentDriver = null;
let currentLocation = null;
let mySocketId = null;
let pendingTripRequest = null;
let awaitingResponse = false;

// Create readline interface for client CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'DRIVER> '
});

// Socket event handlers
function setupSocketListeners() {
  socket.on('connect', () => {
    connected = true;
    mySocketId = socket.id;
    console.log(`\n✓ Connected to server! Your ID: ${socket.id}\n`);

    // If already assumed identity, re-register
    if (currentDriver) {
      socket.emit('assume-identity', {
        userType: 'driver',
        userData: currentDriver,
        location: currentLocation
      });
    }

    rl.prompt();
  });

  socket.on('disconnect', () => {
    connected = false;
    console.log('\n✗ Disconnected from server\n');
    awaitingResponse = false;
    pendingTripRequest = null;
    rl.prompt();
  });

  socket.on('trip-request-notification', (tripData) => {
    pendingTripRequest = tripData;
    awaitingResponse = true;

    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('                 🚗 NEW TRIP REQUEST 🚗');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\nTrip ID: ${tripData.tripId}`);
    console.log(`\nRider: ${tripData.rider.firstName} ${tripData.rider.lastName}`);
    console.log(`Rider ID: ${tripData.rider.userId}`);

    console.log(`\n─── PICKUP ───`);
    console.log(`Location: ${tripData.rider.location.source.title}`);
    console.log(`Address: ${tripData.rider.location.source.fullAddress}`);
    console.log(`Coordinates: (${tripData.rider.location.source.latitude}, ${tripData.rider.location.source.longitude})`);

    console.log(`\n─── DESTINATION ───`);
    console.log(`Location: ${tripData.rider.location.destination.title}`);
    console.log(`Address: ${tripData.rider.location.destination.fullAddress}`);
    console.log(`Coordinates: (${tripData.rider.location.destination.latitude}, ${tripData.rider.location.destination.longitude})`);

    console.log(`\n─── FARE ───`);
    console.log(`Total: ₱${tripData.fare.total.toFixed(2)}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('\nDo you want to accept this trip?');
    console.log('[1] Yes');
    console.log('[2] No');
    console.log('\nEnter your choice (1 or 2): ');

    rl.setPrompt('');
    rl.prompt();
  });

  socket.on('connect_error', (error) => {
    console.log(`\n✗ Connection error: ${error.message}\n`);
    rl.prompt();
  });
}

// CLI commands
function showHelp() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                   DRIVER CLIENT COMMANDS                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('  help                              - Show this help menu');
  console.log('  connect                           - Connect to the server');
  console.log('  disconnect                        - Disconnect from server');
  console.log('  display_riders                    - Show all available riders');
  console.log('  display_drivers                   - Show all available drivers');
  console.log('  display_locations                 - Show all available locations');
  console.log('  assume_driver "{name}"            - Assume driver identity');
  console.log('  assume_location "{location}"      - Set current location');
  console.log('  status                            - Show current status');
  console.log('  exit                              - Exit the client');
  console.log('\n  When trip request arrives:');
  console.log('    1                               - Accept trip');
  console.log('    2                               - Reject trip');
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

  socket.disconnect();
  socket = null;
  connected = false;
  awaitingResponse = false;
  pendingTripRequest = null;
  console.log('Disconnected from server');
}

function assumeDriver(name) {
  if (!name) {
    console.log('Error: Please specify a driver name');
    console.log('Usage: assume_driver "{name}"');
    console.log('Example: assume_driver "John Doe"');
    return;
  }

  const driver = getDriverByName(name);
  if (!driver) {
    console.log(`Error: Driver "${name}" not found`);
    console.log('Use display_drivers to see available drivers');
    return;
  }

  currentDriver = driver;
  console.log(`\n✓ You are now: ${driver.firstName} ${driver.lastName}`);
  console.log(`  User ID: ${driver.userId}\n`);

  // Register with server if connected
  if (connected && socket) {
    socket.emit('assume-identity', {
      userType: 'driver',
      userData: driver,
      location: currentLocation
    });
  }
}

function assumeLocation(locationName) {
  if (!currentDriver) {
    console.log('Error: Please assume a driver identity first');
    console.log('Use: assume_driver "{name}"');
    return;
  }

  if (!locationName) {
    console.log('Error: Please specify a location name');
    console.log('Usage: assume_location "{location}"');
    console.log('Example: assume_location "Makati CBD"');
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

  // Update location on server if connected and driver assumed
  if (connected && socket && currentDriver) {
    // Send full location object including all details
    socket.emit('update-location', {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        title: location.title,
        fullAddress: location.fullAddress,
        place_id: location.place_id,
        name: location.name
      }
    });
  }
}

function showStatus() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                      DRIVER STATUS                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`  Connected: ${connected ? '✓ Yes' : '✗ No'}`);
  console.log(`  Socket ID: ${mySocketId || 'N/A'}`);
  console.log(`  Server URL: ${SERVER_URL}`);
  console.log('');

  if (currentDriver) {
    console.log(`  Driver Identity: ${currentDriver.firstName} ${currentDriver.lastName}`);
    console.log(`  User ID: ${currentDriver.userId}`);
  } else {
    console.log(`  Driver Identity: Not assumed`);
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

function handleTripResponse(choice) {
  if (!awaitingResponse || !pendingTripRequest) {
    console.log('No pending trip request');
    return;
  }

  const accepted = choice === '1';
  const tripData = pendingTripRequest;

  if (accepted) {
    console.log('\n✓ Trip accepted! Notifying rider...\n');
    socket.emit('driver-response', {
      tripId: tripData.tripId,
      driverName: `${currentDriver.firstName} ${currentDriver.lastName}`,
      accepted: true
    });
  } else {
    console.log('\n✗ Trip rejected. Notifying system...\n');
    socket.emit('driver-response', {
      tripId: tripData.tripId,
      driverName: `${currentDriver.firstName} ${currentDriver.lastName}`,
      accepted: false
    });
  }

  awaitingResponse = false;
  pendingTripRequest = null;
  rl.setPrompt('DRIVER> ');
}

// Handle CLI input
rl.on('line', (line) => {
  const input = line.trim();

  // If awaiting trip response, handle 1 or 2
  if (awaitingResponse) {
    if (input === '1' || input === '2') {
      handleTripResponse(input);
      rl.prompt();
      return;
    } else if (input !== '') {
      console.log('Please enter 1 (Accept) or 2 (Reject)');
      return;
    }
  }

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

    case 'assume_driver':
      assumeDriver(arg1);
      break;

    case 'assume_location':
      assumeLocation(arg1);
      break;

    case 'status':
      showStatus();
      break;

    case 'exit':
      console.log('Exiting driver client...');
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
console.log('║              JOYRIDE DRIVER CLIENT                         ║');
console.log('╚════════════════════════════════════════════════════════════╝');
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
