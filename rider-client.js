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
let pendingBooking = null; // Stores pending booking details during delay
let bookingTimeout = null; // Stores timeout reference for cancellation

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
  console.log(boxLine(`  ${cyan('book_trip "from" "to" [delay]')} ${dim('- Book a trip')}`, width));
  console.log(boxLine(`  ${cyan('compute_fare "from" "to"')} ${dim('- Estimate trip fare')}`, width));
  console.log(boxLine(`  ${cyan('display_trip')} ${dim('- Show current trip details')}`, width));
  console.log(boxLine(`  ${cyan('cancel_booking')} ${dim('- Cancel pending booking')}`, width));
  console.log(boxLine(`  ${cyan('add_tip <amount>')} ${dim('- Add tip to pending booking')}`, width));
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

function sendTripRequest(requestPayload) {
  // Start looking for drivers animation
  startLookingForDrivers();

  // Send to server
  socket.emit('trip-request', requestPayload);

  // Clear pending booking state
  pendingBooking = null;
  bookingTimeout = null;
}

function cancelBooking() {
  if (!pendingBooking) {
    console.log('\n' + warning('No pending booking to cancel') + '\n');
    return;
  }

  // Clear the timeout
  if (bookingTimeout) {
    clearTimeout(bookingTimeout);
    bookingTimeout = null;
  }

  const width = 62;
  console.log('\n' + boxTitle(`${emoji.cross} BOOKING CANCELLED`, width));
  console.log(boxLine('', width));
  console.log(boxLine(red('Your booking request has been cancelled'), width));
  console.log(boxLine('', width));
  console.log(boxBottom(width) + '\n');

  pendingBooking = null;
}

function addTip(tipAmount) {
  if (!pendingBooking) {
    console.log('\n' + warning('No pending booking to add tip to') + '\n');
    return;
  }

  const tip = parseFloat(tipAmount);
  if (isNaN(tip) || tip < 0) {
    console.log('\n' + error('Invalid tip amount. Please enter a positive number') + '\n');
    return;
  }

  // Add tip to the pending booking payload
  if (!pendingBooking.payload.data.tip) {
    pendingBooking.payload.data.tip = 0;
  }
  pendingBooking.payload.data.tip = tip;

  const width = 62;
  console.log('\n' + boxTitle(`${emoji.money} TIP ADDED`, width));
  console.log(boxLine('', width));
  console.log(boxLine(green(`Tip amount: ₱${tip.toFixed(2)}`), width));
  console.log(boxLine(dim(`Booking will be sent in ${Math.ceil((pendingBooking.sendTime - Date.now()) / 1000)} seconds`), width));
  console.log(boxLine('', width));
  console.log(boxBottom(width) + '\n');
}

function displayCurrentTrip() {
  if (!pendingBooking) {
    console.log('\n' + warning('No pending booking to display') + '\n');
    return;
  }

  const width = 62;
  const { sourceLocation, destLocation, fareResult, payload, sendTime } = pendingBooking;
  const tip = payload.data.tip || 0;
  const baseFare = fareResult.fare;
  const totalWithTip = baseFare + tip;
  const remainingSeconds = Math.ceil((sendTime - Date.now()) / 1000);

  console.log('\n' + doubleBoxTitle(`${emoji.clock} CURRENT TRIP DETAILS`, width));
  console.log(doubleBoxLine('', width));

  // Rider Info
  console.log(doubleBoxLine(bold(yellow(`${emoji.rider} RIDER`)), width));
  console.log(doubleBoxLine(`  ${cyan(`${payload.data.rider.firstName} ${payload.data.rider.lastName}`)}`, width));
  console.log(doubleBoxLine(`  ${dim(`ID: ${payload.data.rider.userId}`)}`, width));
  console.log(doubleBoxLine('', width));

  // Pickup Location
  console.log(doubleBoxLine(bold(yellow(`${emoji.pickup} PICKUP`)), width));
  console.log(doubleBoxLine(`  ${cyan(sourceLocation.title)}`, width));
  console.log(doubleBoxLine(`  ${dim(sourceLocation.fullAddress)}`, width));
  console.log(doubleBoxLine(`  ${dim(`Coordinates: ${sourceLocation.latitude}, ${sourceLocation.longitude}`)}`, width));
  console.log(doubleBoxLine('', width));

  // Destination
  console.log(doubleBoxLine(bold(yellow(`${emoji.destination} DESTINATION`)), width));
  console.log(doubleBoxLine(`  ${cyan(destLocation.title)}`, width));
  console.log(doubleBoxLine(`  ${dim(destLocation.fullAddress)}`, width));
  console.log(doubleBoxLine(`  ${dim(`Coordinates: ${destLocation.latitude}, ${destLocation.longitude}`)}`, width));
  console.log(doubleBoxLine('', width));

  // Trip Details
  console.log(doubleBoxLine(bold(yellow(`${emoji.info} TRIP DETAILS`)), width));
  console.log(doubleBoxLine(`  Distance: ${bold(fareResult.distance.toFixed(2))} km`, width));
  console.log(doubleBoxLine(`  Estimated Time: ${bold(Math.round(fareResult.time))} minutes`, width));
  console.log(doubleBoxLine('', width));

  // Fare Breakdown
  console.log(doubleBoxLine(bold(yellow(`${emoji.money} FARE BREAKDOWN`)), width));
  console.log(doubleBoxLine(`  Base Fare: ${green(`₱${baseFare.toFixed(2)}`)}`, width));
  if (tip > 0) {
    console.log(doubleBoxLine(`  Tip: ${green(`₱${tip.toFixed(2)}`)}`, width));
    console.log(doubleBoxLine(`  ${dim('─'.repeat(40))}`, width));
    console.log(doubleBoxLine(`  Total Amount: ${green(bold(`₱${totalWithTip.toFixed(2)}`))}`, width));
  } else {
    console.log(doubleBoxLine(`  Tip: ${dim('No tip added')}`, width));
    console.log(doubleBoxLine(`  ${dim('─'.repeat(40))}`, width));
    console.log(doubleBoxLine(`  Total Amount: ${green(bold(`₱${baseFare.toFixed(2)}`))}`, width));
  }
  console.log(doubleBoxLine('', width));

  // Booking Status
  console.log(doubleBoxLine(bold(yellow(`${emoji.clock} BOOKING STATUS`)), width));
  if (remainingSeconds > 0) {
    console.log(doubleBoxLine(`  Status: ${yellow('Scheduled')}`, width));
    console.log(doubleBoxLine(`  Sending in: ${bold(`${remainingSeconds} seconds`)}`, width));
  } else {
    console.log(doubleBoxLine(`  Status: ${red('Overdue - sending soon')}`, width));
  }
  console.log(doubleBoxLine('', width));

  // Available Actions
  console.log(doubleBoxLine(dim(`Available commands:`), width));
  console.log(doubleBoxLine(`  ${cyan('cancel_booking')} - Cancel this booking`, width));
  console.log(doubleBoxLine(`  ${cyan('add_tip <amount>')} - ${tip > 0 ? 'Update tip amount' : 'Add a tip'}`, width));
  console.log(doubleBoxLine('', width));

  console.log(doubleBoxBottom(width) + '\n');
}

async function bookTrip(source, destination, delayInSeconds) {
  if (!connected) {
    console.log('\n' + error('Not connected to server!'));
    console.log(dim('  Use ') + cyan('connect') + dim(' first') + '\n');
    return;
  }

  if (!currentRider) {
    console.log('\n' + error('Please assume a rider identity first'));
    console.log(dim('  Use command: ') + cyan('display_riders') + dim(' to see list of riders'));
    console.log(dim('  Use: ') + cyan('assume_rider "{name}"') + '\n');
    return;
  }

  if (!source || !destination) {
    console.log('\n' + error('Please specify both source and destination'));
    console.log(dim('  Usage: ') + cyan('book_trip "{source}" "{destination}" [delay_seconds]'));
    console.log(dim('  Example: ') + cyan('book_trip "BGC" "Makati" 10') + '\n');
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

  // Parse delay
  const delay = delayInSeconds ? parseInt(delayInSeconds) : 0;
  if (delayInSeconds && (isNaN(delay) || delay < 0)) {
    console.log('\n' + error('Invalid delay. Please enter a positive number of seconds') + '\n');
    return;
  }

  // Compute fare first
  console.log('\n' + info('Computing fare...') + '\n');

  let fareResult;
  try {
    fareResult = await computeFareAPI(
      sourceLocation.latitude,
      sourceLocation.longitude,
      destLocation.latitude,
      destLocation.longitude
    );
  } catch (err) {
    console.log('\n' + error(`Failed to compute fare: ${err.message}`) + '\n');
    return;
  }

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

  const width = 62;

  if (delay > 0) {
    // Store pending booking
    pendingBooking = {
      payload: requestPayload,
      sourceLocation,
      destLocation,
      fareResult,
      sendTime: Date.now() + (delay * 1000)
    };

    console.log(boxTitle(`${emoji.clock} BOOKING SCHEDULED`, width));
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
    console.log(boxLine(`  Distance: ${bold(fareResult.distance.toFixed(2))} km`, width));
    console.log(boxLine(`  Estimated Time: ${bold(Math.round(fareResult.time))} minutes`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold(yellow(`${emoji.money} ESTIMATED FARE`)), width));
    console.log(boxLine(`  Total: ${green(bold(`₱${fareResult.fare.toFixed(2)}`))}`, width));
    console.log(boxLine('', width));
    console.log(boxLine(yellow(`Booking will be sent in ${delay} seconds`), width));
    console.log(boxLine('', width));
    console.log(boxLine(dim(`Available commands:`), width));
    console.log(boxLine(`  ${cyan('cancel_booking')} - Cancel this booking`, width));
    console.log(boxLine(`  ${cyan('add_tip <amount>')} - Add tip to this booking`, width));
    console.log(boxLine('', width));
    console.log(boxBottom(width) + '\n');

    // Schedule the booking
    bookingTimeout = setTimeout(() => {
      console.log('\n' + info('Sending booking request...') + '\n');
      sendTripRequest(requestPayload);
    }, delay * 1000);
  } else {
    // Send immediately with fare display
    console.log(boxTitle(`${emoji.pickup} BOOKING TRIP`, width));
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
    console.log(boxLine(`  Distance: ${bold(fareResult.distance.toFixed(2))} km`, width));
    console.log(boxLine(`  Estimated Time: ${bold(Math.round(fareResult.time))} minutes`, width));
    console.log(boxLine('', width));
    console.log(boxLine(bold(yellow(`${emoji.money} ESTIMATED FARE`)), width));
    console.log(boxLine(`  Total: ${green(bold(`₱${fareResult.fare.toFixed(2)}`))}`, width));
    console.log(boxLine('', width));
    console.log(boxBottom(width) + '\n');

    sendTripRequest(requestPayload);
  }
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

  // Parse command with quoted arguments and optional numeric parameter
  const matches = input.match(/(\w+)(?:\s+"([^"]+)")?(?:\s+"([^"]+)")?(?:\s+(\S+))?/);

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
  const arg3 = matches[4];

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
      bookTrip(arg1, arg2, arg3);
      break;

    case 'display_trip':
      displayCurrentTrip();
      break;

    case 'cancel_booking':
      cancelBooking();
      break;

    case 'add_tip':
      addTip(arg1);
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
