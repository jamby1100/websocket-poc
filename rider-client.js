const io = require('socket.io-client');
const readline = require('readline');
const { getRiders, getDrivers, getLocations, getRiderByName, getLocationByName } = require('./mock-data');
const { success, error, warning, info, bold, dim, green, red, yellow, cyan, gray,
        doubleBoxTitle, doubleBoxLine, doubleBoxSeparator, doubleBoxBottom,
        boxTitle, boxLine, boxBottom, emoji } = require('./colors');

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
    console.log('\n' + success(`Connected to server! Your ID: ${socket.id}`) + '\n');

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
    stopLookingForDrivers();

    // Clear session state
    const hadIdentity = currentRider !== null;
    const hadLocation = currentLocation !== null;
    currentRider = null;
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

  socket.on('trip-created', (data) => {
    stopLookingForDrivers();

    const width = 80;

    console.log('\n');
    console.log(doubleBoxTitle(`${emoji.checkmark} TRIP REQUEST SENT!`, width));
    console.log(doubleBoxLine('', width));

    // Trip ID
    console.log(doubleBoxLine(`${emoji.id} Trip ID: ${dim(data.tripId)}`, width));
    console.log(doubleBoxLine('', width));

    // Pickup
    console.log(doubleBoxLine(bold(yellow(`${emoji.pickup} PICKUP`)), width));
    console.log(doubleBoxLine(`   ${cyan(data.rider.location.source.title)}`, width));
    console.log(doubleBoxLine(`   ${dim(data.rider.location.source.fullAddress)}`, width));
    console.log(doubleBoxLine('', width));

    // Destination
    console.log(doubleBoxLine(bold(yellow(`${emoji.destination} DESTINATION`)), width));
    console.log(doubleBoxLine(`   ${cyan(data.rider.location.destination.title)}`, width));
    console.log(doubleBoxLine(`   ${dim(data.rider.location.destination.fullAddress)}`, width));
    console.log(doubleBoxLine('', width));

    // Fare
    console.log(doubleBoxLine(bold(yellow(`${emoji.money} FARE`)), width));
    console.log(doubleBoxLine(`   Total: ${green(bold(`₱${data.fare.total.toFixed(2)}`))}`, width));
    console.log(doubleBoxLine('', width));

    console.log(doubleBoxBottom(width));
    console.log('');

    // Start continuous "Looking for drivers..." animation
    startLookingForDrivers();

    pendingTripId = data.tripId;
  });

  socket.on('trip-error', (data) => {
    stopLookingForDrivers();

    const width = 80;

    console.log('\n');
    console.log(doubleBoxTitle(`${emoji.cross} BOOKING CANCELLED`, width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxLine(error(`Error: ${data.message}`), width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxBottom(width));
    console.log('');

    pendingTripId = null;
    rl.prompt();
  });

  socket.on('driver-accepted', (data) => {
    stopLookingForDrivers();

    const width = 80;

    console.log('\n');
    console.log(doubleBoxTitle(`${emoji.checkmark} DRIVER ACCEPTED YOUR TRIP!`, width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxLine(`${emoji.driver} Driver: ${green(bold(data.driverName))}`, width));
    console.log(doubleBoxLine(`${emoji.id} Trip ID: ${dim(data.tripId)}`, width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxLine(success('Your ride is confirmed! Get ready.'), width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxBottom(width));
    console.log('');

    pendingTripId = null;
    rl.prompt();
  });

  socket.on('driver-rejected', (data) => {
    // Don't stop animation - keep looking for another driver
    const width = 80;

    console.log('\n');
    console.log(doubleBoxTitle(`${emoji.cross} DRIVER DECLINED`, width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxLine(`${emoji.driver} Driver: ${red(data.driverName)}`, width));
    console.log(doubleBoxLine(`${emoji.id} Trip ID: ${dim(data.tripId)}`, width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxLine(warning('Looking for another driver...'), width));
    console.log(doubleBoxLine('', width));
    console.log(doubleBoxBottom(width));
    console.log('');

    // Continue looking for drivers animation
    if (!lookingForDriversInterval) {
      startLookingForDrivers();
    }
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
  const width = 62;
  console.log('\n' + boxTitle('RIDER CLIENT COMMANDS', width));
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
  console.log(boxLine(`  ${cyan('assume_rider "name"')}   ${dim('- Assume rider identity')}`, width));
  console.log(boxLine(`  ${cyan('assume_location "loc"')} ${dim('- Set current location')}`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold('Trip:'), width));
  console.log(boxLine(`  ${cyan('book_trip "from" "to"')} ${dim('- Book a trip')}`, width));
  console.log(boxLine(`  ${cyan('compute_fare "from" "to"')} ${dim('- Estimate trip fare')}`, width));
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

  stopLookingForDrivers();
  socket.disconnect();
  socket = null;
  connected = false;
  console.log('Disconnected from server');
}

function assumeRider(name) {
  // Check if connected first
  if (!connected) {
    console.log('\n' + error('Not connected to server!'));
    console.log(dim('  Connect first using: ') + cyan('connect') + '\n');
    return;
  }

  if (!name) {
    console.log('\n' + error('Please specify a rider name'));
    console.log(dim('  Usage: ') + cyan('assume_rider "name"'));
    console.log(dim('  Example: ') + cyan('assume_rider "Jane Smith"') + '\n');
    return;
  }

  const rider = getRiderByName(name);
  if (!rider) {
    console.log('\n' + error(`Rider "${name}" not found`));
    console.log(dim('  Use ') + cyan('display_riders') + dim(' to see available riders') + '\n');
    return;
  }

  // Check if overriding existing identity
  if (currentRider) {
    const prevName = `${currentRider.firstName} ${currentRider.lastName}`;
    const newName = `${rider.firstName} ${rider.lastName}`;
    console.log('\n' + warning('Updating identity...'));
    console.log(dim('  Previous: ') + gray(prevName));
    console.log(dim('  New: ') + cyan(newName));
  }

  currentRider = rider;
  console.log(success(`Identity set: ${rider.firstName} ${rider.lastName}`));
  console.log(dim(`  User ID: ${rider.userId}`) + '\n');

  // Register with server
  socket.emit('assume-identity', {
    userType: 'rider',
    userData: rider
  });
}

function assumeLocation(locationName) {
  // Check if connected first
  if (!connected) {
    console.log('\n' + error('Not connected to server!'));
    console.log(dim('  Connect first using: ') + cyan('connect') + '\n');
    return;
  }

  if (!currentRider) {
    console.log('\n' + error('Please assume a rider identity first'));
    console.log(dim('  Use: ') + cyan('assume_rider "name"') + '\n');
    return;
  }

  if (!locationName) {
    console.log('\n' + error('Please specify a location name'));
    console.log(dim('  Usage: ') + cyan('assume_location "location"'));
    console.log(dim('  Example: ') + cyan('assume_location "BGC"') + '\n');
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
}

// Stubbed API function to compute fare
async function computeFareAPI(sourceLat, sourceLon, destLat, destLon) {
  // TODO: Replace with actual API call
  // const response = await fetch('http://api.example.com/compute_fare', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     source: { latitude: sourceLat, longitude: sourceLon },
  //     destination: { latitude: destLat, longitude: destLon }
  //   })
  // });
  // return await response.json();

  // Stubbed response - simulating API calculation
  const R = 6371; // Earth's radius in kilometers
  const dLat = (destLat - sourceLat) * Math.PI / 180;
  const dLon = (destLon - sourceLon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(sourceLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers

  // Calculate fare (example rates)
  const baseFare = 40;
  const perKmRate = 12;
  const fare = baseFare + (distance * perKmRate);

  // Estimate time (assuming average speed of 30 km/h in city traffic)
  const time = (distance / 30) * 60; // Convert to minutes

  return {
    fare: fare,
    distance: distance,
    time: time
  };
}

async function computeFare(source, destination) {
  if (!source || !destination) {
    console.log('\n' + error('Please specify both source and destination'));
    console.log(dim('  Usage: ') + cyan('compute_fare "source" "destination"'));
    console.log(dim('  Example: ') + cyan('compute_fare "BGC" "Makati"') + '\n');
    return;
  }

  const sourceLocation = getLocationByName(source);
  const destLocation = getLocationByName(destination);

  if (!sourceLocation) {
    console.log('\n' + error(`Source location "${source}" not found`));
    console.log(dim('  Use ') + cyan('display_locations') + dim(' to see available locations') + '\n');
    return;
  }

  if (!destLocation) {
    console.log('\n' + error(`Destination location "${destination}" not found`));
    console.log(dim('  Use ') + cyan('display_locations') + dim(' to see available locations') + '\n');
    return;
  }

  console.log('\n' + info('Computing fare...') + '\n');

  try {
    // Call stubbed API
    const result = await computeFareAPI(
      sourceLocation.latitude,
      sourceLocation.longitude,
      destLocation.latitude,
      destLocation.longitude
    );

    const width = 62;

    console.log(boxTitle(`${emoji.money} FARE ESTIMATE`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold(yellow(`${emoji.pickup} PICKUP`)), width));
    console.log(boxLine(`  ${cyan(sourceLocation.title)}`, width));
    console.log(boxLine(`  ${dim(sourceLocation.fullAddress)}`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold(yellow(`${emoji.destination} DESTINATION`)), width));
    console.log(boxLine(`  ${cyan(destLocation.title)}`, width));
    console.log(boxLine(`  ${dim(destLocation.fullAddress)}`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold(yellow(`${emoji.info} TRIP DETAILS`)), width));
    console.log(boxLine(`  Distance: ${bold(result.distance.toFixed(2))} km`, width));
    console.log(boxLine(`  Estimated Time: ${bold(Math.round(result.time))} minutes`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold(yellow(`${emoji.money} ESTIMATED FARE`)), width));
    console.log(boxLine(`  Total: ${green(bold(`₱${result.fare.toFixed(2)}`))}`, width));
    console.log(boxLine('', width));
    console.log(boxBottom(width) + '\n');
    console.log("Press Enter to continue:" + '\n');
  } catch (err) {
    console.log('\n' + error(`Failed to compute fare: ${err.message}`) + '\n');
  }
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
  const width = 62;

  console.log('\n' + doubleBoxTitle(`RIDER STATUS ${emoji.rider}`, width));
  console.log(doubleBoxLine('', width));

  // Connection status
  const connIcon = connected ? emoji.checkmark : emoji.cross;
  const connText = connected ? green('Connected') : gray('Offline');
  console.log(doubleBoxLine(`${emoji.connection} Connection    ${connIcon} ${connText}`, width));
  console.log(doubleBoxLine(`${emoji.id} Socket ID      ${dim(mySocketId || 'N/A')}`, width));
  console.log(doubleBoxLine(`${emoji.server} Server         ${dim(SERVER_URL)}`, width));
  console.log(doubleBoxLine('', width));

  // Identity
  if (currentRider) {
    const riderName = cyan(`${currentRider.firstName} ${currentRider.lastName}`);
    console.log(doubleBoxLine(`${emoji.rider} Identity       ${riderName}`, width));
    console.log(doubleBoxLine(`   User ID        ${dim(currentRider.userId)}`, width));
  } else {
    console.log(doubleBoxLine(`${emoji.rider} Identity       ${gray('Not assumed')}`, width));
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

    case 'compute_fare':
      computeFare(arg1, arg2);
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
console.log('\n' + doubleBoxTitle('JOYRIDE RIDER CLIENT', 62));
console.log(doubleBoxLine('', 62));
console.log(doubleBoxLine(`${emoji.rider} Welcome to the Joyride Rider Client!`, 62));
console.log(doubleBoxLine('', 62));
console.log(doubleBoxBottom(62));
console.log('\n' + dim('  Type ') + cyan('connect') + dim(' to connect to the server'));
console.log(dim('  Type ') + cyan('help') + dim(' for available commands\n'));
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
