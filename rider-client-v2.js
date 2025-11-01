const io = require('socket.io-client');
const readline = require('readline');
const { getRiders, getDrivers, getLocations, getRiderByName, getLocationByName } = require('./mock-data');
const { success, error, warning, info, bold, dim, green, red, yellow, cyan, gray,
        doubleBoxTitle, doubleBoxLine, doubleBoxSeparator, doubleBoxBottom,
        boxTitle, boxLine, boxBottom, emoji } = require('./colors');

// Import domain classes
const Rider = require('./app/domains/rider');
const Driver = require('./app/domains/driver');
const Trip = require('./app/domains/trip');
const Location = require('./app/domains/location');

const showHelp = require('./app/helpers/showHelp');

// Server configuration
const SERVER_HOST = process.env.WEBSOCKET_SERVER || 'localhost';
const SERVER_PORT = process.env.WEBSOCKET_PORT || '3000';
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// Client state
let socket = null;
let connected = false;
let currentRider = null; // Will be a Rider instance
let currentLocation = null;
let mySocketId = null;
let lookingForDriversInterval = null;
let currentTrip = null; // Will be a Trip instance (replaces pendingTripId, pendingBooking, activeTripData)
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
  
      // If already assumed identity, re-register and check for active trips
      if (currentRider) {
        socket.emit('assume-identity', {
          userType: 'rider',
          userData: currentRider.data
        });
  
        // Check for active trips for this user
        console.log(info('Checking for active trips...'));
        socket.emit('check-active-trip', {
          userId: currentRider.data.userId
        });
      } else {
        rl.prompt();
      }
    });
  
    socket.on('disconnect', () => {
      connected = false;

      // Clear session state
      const hadIdentity = currentRider !== null;
      const hadLocation = currentLocation !== null;
      const hadTrip = currentTrip !== null;
      currentRider = null;
      currentLocation = null;
      currentTrip = null;
  
      console.log('\n' + error('Disconnected from server'));
      if (hadIdentity || hadLocation || hadTrip) {
        console.log(warning('Session cleared:'));
        if (hadIdentity) console.log(dim('  • Identity reset'));
        if (hadLocation) console.log(dim('  • Location reset'));
        if (hadTrip) console.log(dim('  • Trip cleared'));
      }
      console.log('');
  
      rl.prompt();
    });
  
    socket.on('trip-created', (data) => {
      const width = 80;
  
      console.log('\n');
      console.log(doubleBoxTitle(`${emoji.checkmark} TRIP REQUEST SENT!`, width));
      console.log(doubleBoxLine('', width));
  
      // Trip ID
      console.log(doubleBoxLine(`${emoji.id} Trip ID: ${dim(currentTrip.data.tripId)}`, width));
      console.log(doubleBoxLine('', width));
  
      // Pickup
      console.log(doubleBoxLine(bold(yellow(`${emoji.pickup} PICKUP`)), width));
      console.log(doubleBoxLine(`   ${cyan(currentTrip.data.sourceLocation.title)}`, width));
      console.log(doubleBoxLine(`   ${dim(currentTrip.data.sourceLocation.fullAddress)}`, width));
      console.log(doubleBoxLine('', width));
  
      // Destination
      console.log(doubleBoxLine(bold(yellow(`${emoji.destination} DESTINATION`)), width));
      console.log(doubleBoxLine(`   ${cyan(currentTrip.data.destLocation.title)}`, width));
      console.log(doubleBoxLine(`   ${dim(currentTrip.data.destLocation.fullAddress)}`, width));
      console.log(doubleBoxLine('', width));
  
      // Fare
      console.log(doubleBoxLine(bold(yellow(`${emoji.money} FARE`)), width));
      console.log(doubleBoxLine(`   Total: ${green(bold(`₱${currentTrip.data.fare.baseFare.toFixed(2)}`))}`, width));
      console.log(doubleBoxLine('', width));
  
      console.log(doubleBoxBottom(width));
      console.log('');
  
      // // Create Trip instance from trip-created event
      // currentTrip = Trip.fromTripCreatedEvent(data);
    });
  
    socket.on('trip-error', (data) => {
  
      const width = 80;
  
      console.log('\n');
      console.log(doubleBoxTitle(`${emoji.cross} BOOKING CANCELLED`, width));
      console.log(doubleBoxLine('', width));
      console.log(doubleBoxLine(error(`Error: ${data.message}`), width));
      console.log(doubleBoxLine('', width));
      console.log(doubleBoxBottom(width));
      console.log('');
  
      currentTrip = null;
      rl.prompt();
    });
  
    socket.on('driver-accepted', (data) => {
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
  
      // Update trip status and driver info
      if (currentTrip) {
        currentTrip.setStatus('accepted');
        currentTrip.data.driver = { name: data.driverName };
      }
  
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
  
    socket.on('active-trip-response', (data) => {
      if (data.hasActiveTrip && data.tripData) {
        // User has an active trip - restore trip data
        const width = 80;
  
        console.log('\n');
        console.log(doubleBoxTitle(`${emoji.info} ACTIVE TRIP FOUND`, width));
        console.log(doubleBoxLine('', width));
        console.log(doubleBoxLine(yellow(`You have an active trip in progress!`), width));
        console.log(doubleBoxLine('', width));
        console.log(doubleBoxLine(`${emoji.id} Trip ID: ${dim(data.tripData.tripId)}`, width));
        console.log(doubleBoxLine(`${emoji.pickup} From: ${cyan(data.tripData.rider.location.source.title)}`, width));
        console.log(doubleBoxLine(`${emoji.destination} To: ${cyan(data.tripData.rider.location.destination.title)}`, width));
        console.log(doubleBoxLine('', width));
        console.log(doubleBoxLine(dim(`Use ${cyan('display_trip')} to view full details`), width));
        console.log(doubleBoxLine(dim(`You cannot book new trips until this one completes`), width));
        console.log(doubleBoxLine('', width));
        console.log(doubleBoxBottom(width));
        console.log('');
  
        // Restore trip data as Trip instance
        currentTrip = Trip.fromData(data.tripData);
  
        // If still looking for drivers, start animation
        if (currentTrip.isLookingForDriver() || currentTrip.isPending()) {
          startLookingForDrivers();
        }
      } else {
        // No active trip
        console.log('\n' + dim(`No active trips found for ${currentRider.getFullName()}`) + '\n');
      }
  
      rl.prompt();
    });

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

  const riderData = getRiderByName(name);
  if (!riderData) {
    console.log('\n' + error(`Rider "${name}" not found`));
    console.log(dim('  Use ') + cyan('display_riders') + dim(' to see available riders') + '\n');
    return;
  }

  // Create Rider instance
  const rider = new Rider(riderData);

  // Check if overriding existing identity
  if (currentRider) {
    const prevName = currentRider.getFullName();
    const newName = rider.getFullName();
    console.log('\n' + warning('Updating identity...'));
    console.log(dim('  Previous: ') + gray(prevName));
    console.log(dim('  New: ') + cyan(newName));
  }

  currentRider = rider;
  console.log(success(`Identity set: ${rider.getFullName()}`));
  console.log(dim(`  User ID: ${rider.data.userId}`));

  // Register with server
  socket.emit('assume-identity', {
    userType: 'rider',
    userData: rider.data
  });

  // Check for active trips for this user
  console.log(info('Checking for active trips...'));
  socket.emit('check-active-trip', {
    userId: rider.data.userId
  });
}

function sendTripRequest(requestPayload) {
  // Send to server
  socket.emit('trip-request', requestPayload);

  // Update trip status if exists
  if (currentTrip && currentTrip.isPending()) {
    currentTrip.setStatus('looking_for_driver');
  }

  // Clear timeout reference
  bookingTimeout = null;
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
    baseFare: fare,
    distance: distance,
    time: time
  };
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

  // Check if user already has an active trip
  if (currentTrip && currentTrip.isActive()) {
    const width = 62;
    console.log('\n' + boxTitle(`${emoji.warning} CANNOT BOOK TRIP`, width));
    console.log(boxLine('', width));
    console.log(boxLine(red('You already have an active trip!'), width));
    console.log(boxLine('', width));
    if (currentTrip.data.tripId) {
      console.log(boxLine(`Trip ID: ${dim(currentTrip.data.tripId)}`, width));
      console.log(boxLine('', width));
    }
    console.log(boxLine(dim(`Use ${cyan('display_trip')} to view trip details`), width));
    console.log(boxLine(dim('Complete your current trip before booking a new one'), width));
    console.log(boxLine('', width));
    console.log(boxBottom(width) + '\n');
    return;
  }

  if (!source || !destination) {
    console.log('\n' + error('Please specify both source and destination'));
    console.log(dim('  Usage: ') + cyan('book_trip "{source}" "{destination}" [delay_seconds]'));
    console.log(dim('  Example: ') + cyan('book_trip "BGC" "Makati" 10') + '\n');
    return;
  }

  const sourceData = getLocationByName(source);
  const destData = getLocationByName(destination);

  if (!sourceData) {
    console.log('\n' + error(`Source location "${source}" not found`));
    console.log(dim('  Use ') + cyan('display_locations') + dim(' to see available locations') + '\n');
    return;
  }

  if (!destData) {
    console.log('\n' + error(`Destination location "${destination}" not found`));
    console.log(dim('  Use ') + cyan('display_locations') + dim(' to see available locations') + '\n');
    return;
  }

  // Create Location instances
  const sourceLocation = new Location(sourceData);
  const destLocation = new Location(destData);

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
      sourceLocation.data.latitude,
      sourceLocation.data.longitude,
      destLocation.data.latitude,
      destLocation.data.longitude
    );
  } catch (err) {
    console.log('\n' + error(`Failed to compute fare: ${err.message}`) + '\n');
    console.log(dim('Stack trace:'));
    console.log(dim(err.stack) + '\n');
    return;
  }

  // Double-check currentRider still exists (in case of disconnect during fare computation)
  if (!currentRider) {
    console.log('\n' + error('Rider identity was cleared. Please assume a rider identity again.') + '\n');
    return;
  }

  // Build the request payload using Rider class method
  const requestPayload = {
    action: 'create_trip',
    header: {},
    data: {
      rider: currentRider.createTripPayload(sourceLocation, destLocation)
    }
  };

  const width = 62;

  // Create pending trip using Trip class
  currentTrip = Trip.createPendingBooking(
    requestPayload,
    sourceLocation,
    destLocation,
    fareResult,
    currentRider,
    Date.now() + (delay * 1000)
  );


  // Send immediately with fare display
  console.log(boxTitle(`${emoji.pickup} BOOKING TRIP`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold(yellow(`${emoji.pickup} PICKUP`)), width));
  console.log(boxLine(`  ${cyan(sourceLocation.data.title)}`, width));
  console.log(boxLine(`  ${dim(sourceLocation.data.fullAddress)}`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold(yellow(`${emoji.destination} DESTINATION`)), width));
  console.log(boxLine(`  ${cyan(destLocation.data.title)}`, width));
  console.log(boxLine(`  ${dim(destLocation.data.fullAddress)}`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold(yellow(`${emoji.info} TRIP DETAILS`)), width));
  console.log(boxLine(`  Distance: ${bold(fareResult.distance.toFixed(2))} km`, width));
  console.log(boxLine(`  Estimated Time: ${bold(Math.round(fareResult.time))} minutes`, width));
  console.log(boxLine('', width));
  console.log(boxLine(bold(yellow(`${emoji.money} FARE BREAKDOWN`)), width));
  console.log(boxLine(`  Base Fare: ${green(`₱${fareResult.baseFare.toFixed(2)}`)}`, width));
  console.log(boxLine(`  Tip: ${dim('No tip added')}`, width));
  console.log(boxLine(`  ${dim('─'.repeat(40))}`, width));
  console.log(boxLine(`  Total Amount: ${green(bold(`₱${fareResult.baseFare.toFixed(2)}`))}`, width));
  console.log(boxLine('', width));
  console.log(boxBottom(width) + '\n');

  sendTripRequest(requestPayload);
}

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