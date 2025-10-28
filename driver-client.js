const io = require('socket.io-client');
const readline = require('readline');
const { getRiders, getDrivers, getLocations, getDriverByName, getLocationByName } = require('./mock-data');
const { success, error, warning, info, bold, dim, red,green, yellow, cyan, gray,
        doubleBoxTitle, doubleBoxLine, doubleBoxSeparator, doubleBoxBottom,
        boxTitle, boxLine, boxBottom, emoji } = require('./colors');

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
    console.log('\n' + success(`Connected to server! Your ID: ${socket.id}`) + '\n');

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
    awaitingResponse = false;
    pendingTripRequest = null;

    // Clear session state
    const hadIdentity = currentDriver !== null;
    const hadLocation = currentLocation !== null;
    currentDriver = null;
    currentLocation = null;

    console.log('\n' + error('Disconnected from server'));
    if (hadIdentity || hadLocation) {
      console.log(warning('Session cleared:'));
      if (hadIdentity) console.log(dim('  • Identity reset'));
      if (hadLocation) console.log(dim('  • Location reset'));
    }
    console.log('');

    rl.prompt();
  });

  socket.on('trip-request-notification', (tripData) => {
    pendingTripRequest = tripData;
    awaitingResponse = true;

    const width = 80;

    console.log('\n');
    console.log(doubleBoxTitle(`${emoji.alert} NEW TRIP REQUEST ${emoji.alert}`, width));
    console.log(doubleBoxLine('', width));

    // Trip ID
    console.log(doubleBoxLine(`${emoji.id} Trip ID: ${dim(tripData.tripId)}`, width));
    console.log(doubleBoxLine('', width));

    // Rider info
    const riderName = cyan(`${tripData.rider.firstName} ${tripData.rider.lastName}`);
    console.log(doubleBoxLine(`${emoji.rider} Rider: ${riderName}`, width));
    console.log(doubleBoxLine(`   User ID: ${dim(tripData.rider.userId)}`, width));
    console.log(doubleBoxLine('', width));

    // Pickup location
    console.log(doubleBoxLine(bold(yellow(`${emoji.pickup} PICKUP`)), width));
    console.log(doubleBoxLine(`   ${cyan(tripData.rider.location.source.title)}`, width));
    console.log(doubleBoxLine(`   ${dim(tripData.rider.location.source.fullAddress)}`, width));
    console.log(doubleBoxLine(`   ${dim(`Coordinates: ${tripData.rider.location.source.latitude}, ${tripData.rider.location.source.longitude}`)}`, width));
    console.log(doubleBoxLine('', width));

    // Destination
    console.log(doubleBoxLine(bold(yellow(`${emoji.destination} DESTINATION`)), width));
    console.log(doubleBoxLine(`   ${cyan(tripData.rider.location.destination.title)}`, width));
    console.log(doubleBoxLine(`   ${dim(tripData.rider.location.destination.fullAddress)}`, width));
    console.log(doubleBoxLine(`   ${dim(`Coordinates: ${tripData.rider.location.destination.latitude}, ${tripData.rider.location.destination.longitude}`)}`, width));
    console.log(doubleBoxLine('', width));

    // Fare
    console.log(doubleBoxLine(bold(yellow(`${emoji.money} FARE`)), width));
    console.log(doubleBoxLine(`   Total: ${green(bold(`₱${tripData.fare.total.toFixed(2)}`))}`, width));
    console.log(doubleBoxLine('', width));

    console.log(doubleBoxBottom(width));

    // Accept/Reject options
    console.log('\n' + bold('Do you want to accept this trip?'));
    console.log(yellow('[1]') + ' ' + green('Yes'));
    console.log(yellow('[2]') + ' ' + red('No'));
    console.log('\n' + dim('Enter your choice (1 or 2): '));

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
  const width = 62;
  console.log('\n' + boxTitle('DRIVER CLIENT COMMANDS', width));
  console.log(boxLine('', width));
  console.log(boxLine(bold('Connection:'), width));
  console.log(boxLine(`  ${cyan('connect')}               ${dim('- Connect to the server')}`, width));
  console.log(boxLine(`  ${cyan('disconnect')}            ${dim('- Disconnect from server')}`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold('Display Info:'), width));
  console.log(boxLine(`  ${cyan('display_riders')}        ${dim('- Show all available riders')}`, width));
  console.log(boxLine(`  ${cyan('display_drivers')}       ${dim('- Show all available drivers')}`, width));
  console.log(boxLine(`  ${cyan('display_locations')}     ${dim('- Show all available locations')}`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold('Identity & Location:'), width));
  console.log(boxLine(`  ${cyan('assume_driver "name"')}  ${dim('- Assume driver identity')}`, width));
  console.log(boxLine(`  ${cyan('assume_location "loc"')} ${dim('- Set current location')}`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold('Trip Response:'), width));
  console.log(boxLine(`  ${green('1')}                       ${dim('- Accept trip request')}`, width));
  console.log(boxLine(`  ${red('2')}                       ${dim('- Reject trip request')}`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold('Other:'), width));
  console.log(boxLine(`  ${cyan('status')}                ${dim('- Show current status')}`, width));
  console.log(boxLine(`  ${cyan('help')}                  ${dim('- Show this help menu')}`, width));
  console.log(boxLine(`  ${cyan('exit')}                  ${dim('- Exit the client')}`, width));
  console.log(boxLine('', width));
  console.log(boxBottom(width) + '\n');
}

function displayRiders() {
  const riders = getRiders();
  const width = 62;

  console.log('\n' + boxTitle(`AVAILABLE RIDERS ${emoji.rider}`, width));
  console.log(boxLine('', width));

  riders.forEach((rider, index) => {
    const num = yellow(`[${index + 1}]`);
    const name = bold(cyan(rider.name));
    console.log(boxLine(`${num} ${name}`, width));
    console.log(boxLine(`    ${dim('ID:')} ${gray(rider.userId)}`, width));
    if (index < riders.length - 1) {
      console.log(boxLine('', width));
    }
  });

  console.log(boxLine('', width));
  console.log(boxLine(dim(`Total: ${riders.length} rider${riders.length !== 1 ? 's' : ''}`), width));
  console.log(boxBottom(width) + '\n');
}

function displayDrivers() {
  const drivers = getDrivers();
  const width = 62;

  console.log('\n' + boxTitle(`AVAILABLE DRIVERS ${emoji.driver}`, width));
  console.log(boxLine('', width));

  drivers.forEach((driver, index) => {
    const num = yellow(`[${index + 1}]`);
    const name = bold(cyan(driver.name));
    console.log(boxLine(`${num} ${name}`, width));
    console.log(boxLine(`    ${dim(`${emoji.phone}`)} ${gray(driver.userId)}`, width));
    if (index < drivers.length - 1) {
      console.log(boxLine('', width));
    }
  });

  console.log(boxLine('', width));
  console.log(boxLine(dim(`Total: ${drivers.length} driver${drivers.length !== 1 ? 's' : ''}`), width));
  console.log(boxBottom(width) + '\n');
}

function displayLocations() {
  const locations = getLocations();
  const width = 62;

  console.log('\n' + boxTitle(`AVAILABLE LOCATIONS ${emoji.location}`, width));
  console.log(boxLine('', width));

  locations.forEach((loc, index) => {
    const num = yellow(`[${index + 1}]`);
    const name = bold(cyan(loc.name));
    const coords = gray(`(${loc.latitude}, ${loc.longitude})`);
    console.log(boxLine(`${num} ${name} ${dim(coords)}`, width));
    console.log(boxLine(`    ${dim(loc.title)}`, width));
    if (index < locations.length - 1) {
      console.log(boxLine('', width));
    }
  });

  console.log(boxLine('', width));
  console.log(boxLine(dim(`Total: ${locations.length} location${locations.length !== 1 ? 's' : ''}`), width));
  console.log(boxBottom(width) + '\n');
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
  // Check if connected first
  if (!connected) {
    console.log('\n' + error('Not connected to server!'));
    console.log(dim('  Connect first using: ') + cyan('connect') + '\n');
    return;
  }

  if (!name) {
    console.log('\n' + error('Please specify a driver name'));
    console.log(dim('  Usage: ') + cyan('assume_driver "name"'));
    console.log(dim('  Example: ') + cyan('assume_driver "John Doe"') + '\n');
    return;
  }

  const driver = getDriverByName(name);
  if (!driver) {
    console.log('\n' + error(`Driver "${name}" not found`));
    console.log(dim('  Use ') + cyan('display_drivers') + dim(' to see available drivers') + '\n');
    return;
  }

  // Check if overriding existing identity
  if (currentDriver) {
    const prevName = `${currentDriver.firstName} ${currentDriver.lastName}`;
    const newName = `${driver.firstName} ${driver.lastName}`;
    console.log('\n' + warning('Updating identity...'));
    console.log(dim('  Previous: ') + gray(prevName));
    console.log(dim('  New: ') + cyan(newName));
  }

  currentDriver = driver;
  console.log(success(`Identity set: ${driver.firstName} ${driver.lastName}`));
  console.log(dim(`  User ID: ${driver.userId}`) + '\n');

  // Register with server
  socket.emit('assume-identity', {
    userType: 'driver',
    userData: driver,
    location: currentLocation
  });
}

function assumeLocation(locationName) {
  // Check if connected first
  if (!connected) {
    console.log('\n' + error('Not connected to server!'));
    console.log(dim('  Connect first using: ') + cyan('connect') + '\n');
    return;
  }

  if (!currentDriver) {
    console.log('\n' + error('Please assume a driver identity first'));
    console.log(dim('  Use: ') + cyan('assume_driver "name"') + '\n');
    return;
  }

  if (!locationName) {
    console.log('\n' + error('Please specify a location name'));
    console.log(dim('  Usage: ') + cyan('assume_location "location"'));
    console.log(dim('  Example: ') + cyan('assume_location "Makati CBD"') + '\n');
    return;
  }

  const location = getLocationByName(locationName);
  if (!location) {
    console.log('\n' + error(`Location "${locationName}" not found`));
    console.log(dim('  Use ') + cyan('display_locations') + dim(' to see available locations') + '\n');
    return;
  }

  // Check if overriding existing location
  if (currentLocation) {
    console.log('\n' + warning('Updating location...'));
    console.log(dim('  Previous: ') + gray(currentLocation.name));
    console.log(dim('  New: ') + yellow(location.name));
  }

  currentLocation = location;
  console.log(success(`Location set: ${location.title}`));
  console.log(dim(`  Address: ${location.fullAddress}`));
  console.log(dim(`  Coordinates: (${location.latitude}, ${location.longitude})`) + '\n');

  // Update location on server
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

function showStatus() {
  const width = 62;

  console.log('\n' + doubleBoxTitle(`DRIVER STATUS ${emoji.driver}`, width));
  console.log(doubleBoxLine('', width));

  // Connection status
  const connIcon = connected ? emoji.checkmark : emoji.cross;
  const connText = connected ? green('Connected') : gray('Offline');
  console.log(doubleBoxLine(`${emoji.connection} Connection    ${connIcon} ${connText}`, width));
  console.log(doubleBoxLine(`${emoji.id} Socket ID      ${dim(mySocketId || 'N/A')}`, width));
  console.log(doubleBoxLine(`${emoji.server} Server         ${dim(SERVER_URL)}`, width));
  console.log(doubleBoxLine('', width));

  // Identity
  if (currentDriver) {
    const driverName = cyan(`${currentDriver.firstName} ${currentDriver.lastName}`);
    console.log(doubleBoxLine(`${emoji.driver} Identity       ${driverName}`, width));
    console.log(doubleBoxLine(`   User ID        ${dim(currentDriver.userId)}`, width));
  } else {
    console.log(doubleBoxLine(`${emoji.driver} Identity       ${gray('Not assumed')}`, width));
  }
  console.log(doubleBoxLine('', width));

  // Location
  if (currentLocation) {
    console.log(doubleBoxLine(`${emoji.location} Location       ${yellow(currentLocation.title)}`, width));
    console.log(doubleBoxLine(`   ${dim(currentLocation.fullAddress)}`, width));
    console.log(doubleBoxLine(`   ${dim(`Coordinates: ${currentLocation.latitude}, ${currentLocation.longitude}`)}`, width));
  } else {
    console.log(doubleBoxLine(`${emoji.location} Location       ${gray('Not set')}`, width));
  }

  console.log(doubleBoxLine('', width));
  console.log(doubleBoxBottom(width) + '\n');
}

function handleTripResponse(choice) {
  if (!awaitingResponse || !pendingTripRequest) {
    console.log('No pending trip request');
    return;
  }

  const accepted = choice === '1';
  const tripData = pendingTripRequest;

  if (accepted) {
    console.log('\n' + success('Trip accepted! Notifying rider...') + '\n');
    socket.emit('driver-response', {
      tripId: tripData.tripId,
      driverName: `${currentDriver.firstName} ${currentDriver.lastName}`,
      accepted: true
    });
  } else {
    console.log('\n' + warning('Trip rejected. Notifying system...') + '\n');
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
console.log('\n' + doubleBoxTitle('JOYRIDE DRIVER CLIENT', 62));
console.log(doubleBoxLine('', 62));
console.log(doubleBoxLine(`${emoji.driver} Welcome to the Joyride Driver Client!`, 62));
console.log(doubleBoxLine('', 62));
console.log(doubleBoxBottom(62));
console.log('\n' + dim('  Type ') + cyan('connect') + dim(' to connect to the server'));
console.log(dim('  Type ') + cyan('help') + dim(' for available commands\n'));
rl.prompt();

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT. Shutting down...');
  if (connected && socket) {
    socket.disconnect();
  }
  process.exit(0);
});
