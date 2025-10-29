# WebSocket - Rider-Driver Booking System Guide

A real-time WebSocket-based trip booking system for riders and drivers, built with Socket.IO and Node.js.

## Features

- Real-time communication between riders and drivers
- External API integration for trip creation
- Mock data for testing (riders, drivers, locations)
- Accept/Reject trip workflow
- CLI-based interface for easy testing

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm run server
# Then type: start
```

### 3. Start a Driver Client (Terminal 2)

```bash
npm run driver
```

Commands:
```
connect
display_drivers
assume_driver "John Doe"
display_locations
assume_location "Makati CBD"
```

### 4. Start a Rider Client (Terminal 3)

```bash
npm run rider
```

Commands:
```
connect
display_riders
assume_rider "Jane Smith"
display_locations
book_trip "BGC" "Makati CBD"
```

---

## Rider Client Commands

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Show help menu | `help` |
| `connect` | Connect to server | `connect` |
| `disconnect` | Disconnect from server | `disconnect` |
| `display_riders` | Show available riders | `display_riders` |
| `display_drivers` | Show available drivers | `display_drivers` |
| `display_locations` | Show available locations | `display_locations` |
| `assume_rider "{name}"` | Assume rider identity | `assume_rider "Jane Smith"` |
| `assume_location "{location}"` | Set current location | `assume_location "BGC"` |
| `book_trip "{source}" "{dest}"` | Book a trip | `book_trip "BGC" "Makati CBD"` |
| `status` | Show current status | `status` |
| `exit` | Exit client | `exit` |

---

## Driver Client Commands

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Show help menu | `help` |
| `connect` | Connect to server | `connect` |
| `disconnect` | Disconnect from server | `disconnect` |
| `display_riders` | Show available riders | `display_riders` |
| `display_drivers` | Show available drivers | `display_drivers` |
| `display_locations` | Show available locations | `display_locations` |
| `assume_driver "{name}"` | Assume driver identity | `assume_driver "John Doe"` |
| `assume_location "{location}"` | Set current location | `assume_location "Makati CBD"` |
| `status` | Show current status | `status` |
| `1` | Accept trip (when prompted) | `1` |
| `2` | Reject trip (when prompted) | `2` |
| `exit` | Exit client | `exit` |

---

## Complete Workflow Example

### Terminal 1: Start Server
```bash
npm run server
```
Server output:
```
SERVER> start
✓ Socket.IO server started on http://localhost:3000
```

### Terminal 2: Driver Setup
```bash
npm run driver
```
Driver commands:
```
DRIVER> connect
✓ Connected to server!

DRIVER> display_drivers
╔════════════════════════════════════════════════════════════╗
║                    AVAILABLE DRIVERS                       ║
╚════════════════════════════════════════════════════════════╝
  John Doe
    User ID: 639600487429
    First Name: John
    Last Name: Doe

  Maria Santos
    User ID: 639600487430
    ...

DRIVER> assume_driver "John Doe"
✓ You are now: John Doe
  User ID: 639600487429

DRIVER> display_locations
╔════════════════════════════════════════════════════════════╗
║                    AVAILABLE LOCATIONS                     ║
╚════════════════════════════════════════════════════════════╝
  BGC
    Title: Bonifacio Global City
    Address: Bonifacio Global City, Taguig, Metro Manila, Philippines
    Coordinates: (14.5547, 121.0244)
    Place ID: bgc_001

  Makati CBD
    Title: Makati Central Business District
    ...

DRIVER> assume_location "Makati CBD"
✓ Current location set to: Makati Central Business District
  Address: Makati Central Business District, Makati, Metro Manila, Philippines
  Coordinates: (14.5547, 121.0278)
```

### Terminal 3: Rider Books Trip
```bash
npm run rider
```
Rider commands:
```
RIDER> connect
✓ Connected to server!

RIDER> assume_rider "Jane Smith"
✓ You are now: Jane Smith
  User ID: 550e8400-e29b-41d4-a716-446655440001

RIDER> book_trip "BGC" "Makati CBD"
📍 Booking trip...
   From: Bonifacio Global City
   To: Makati Central Business District

⠋ Looking for drivers...
```

### Server Output (Terminal 1)
```
[TRIP REQUEST] Received from socket-id-xxx
[TRIP REQUEST] Action: create_trip
[API CALL] POST http://joyride-rewrite-alb-1006628052.ap-southeast-2.elb.amazonaws.com/trips
[API RESPONSE] Status: 200
[DRIVER ASSIGNMENT] Driver assigned: John Doe
[DRIVER NOTIFICATION] Notifying driver John Doe (socket-id-yyy)
```

### Rider Sees Trip Created (Terminal 3)
```
╔════════════════════════════════════════════════════════════╗
║              ✓ TRIP REQUEST SENT!                         ║
╚════════════════════════════════════════════════════════════╝

Trip ID: 077fa353-d1a1-4d4f-9a45-5de3a1b0cb33

─── TRIP DETAILS ───
Pickup: Bonifacio Global City
       Bonifacio Global City, Taguig, Metro Manila, Philippines

Destination: Makati Central Business District
            Makati Central Business District, Makati, Metro Manila, Philippines

─── FARE ───
TOTAL: ₱49.00

⏳ Waiting for driver to accept...
```

### Driver Receives Request (Terminal 2)
```

═══════════════════════════════════════════════════════════
                 🚗 NEW TRIP REQUEST 🚗
═══════════════════════════════════════════════════════════

Trip ID: 077fa353-d1a1-4d4f-9a45-5de3a1b0cb33

Rider: Jane Smith
Rider ID: 550e8400-e29b-41d4-a716-446655440001

─── PICKUP ───
Location: Bonifacio Global City
Address: Bonifacio Global City, Taguig, Metro Manila, Philippines
Coordinates: (14.5547, 121.0244)

─── DESTINATION ───
Location: Makati Central Business District
Address: Makati Central Business District, Makati, Metro Manila, Philippines
Coordinates: (14.5547, 121.0278)

─── FARE ───
Total: ₱49.00

═══════════════════════════════════════════════════════════

Do you want to accept this trip?
[1] Yes
[2] No

Enter your choice (1 or 2):
```

### Driver Accepts (Terminal 2)
```
1
✓ Trip accepted! Notifying rider...
```

### Rider Receives Confirmation (Terminal 3)
```
╔════════════════════════════════════════════════════════════╗
║              ✓ DRIVER ACCEPTED YOUR TRIP!                 ║
╚════════════════════════════════════════════════════════════╝

🚗 Driver: John Doe
Trip ID: 077fa353-d1a1-4d4f-9a45-5de3a1b0cb33
```

---

## Mock Data

### Available Riders
- **Jane Smith** (550e8400-e29b-41d4-a716-446655440001)
- **Lisa Wong** (550e8400-e29b-41d4-a716-446655440002)
- **Mark Garcia** (550e8400-e29b-41d4-a716-446655440003)
- **Sarah Lee** (550e8400-e29b-41d4-a716-446655440004)

### Available Drivers
- **John Doe** (639600487429)
- **Maria Santos** (639600487430)
- **Pedro Cruz** (639600487431)
- **Ana Reyes** (639600487432)
- **Carlos Tan** (639600487433)

### Available Locations
- **BGC** - Bonifacio Global City (14.5547, 121.0244)
- **Makati CBD** - Makati Central Business District (14.5547, 121.0278)
- **Ortigas** - Ortigas Center (14.5858, 121.0615)
- **QC Circle** - Quezon City Circle (14.6513, 121.0497)
- **Manila Bay** - Manila Bay Area (14.5787, 120.9751)
- **Alabang** - Alabang Town Center (14.4198, 121.0424)
- **MOA** - SM Mall of Asia (14.5362, 120.9822)

---

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Rider Client   │         │  WebSocket       │         │  Driver Client  │
│  (Terminal)     │◄───────►│    Server        │◄───────►│  (Terminal)     │
└────────┬────────┘         └────────┬─────────┘         └─────────────────┘
         │                           │
         │ HTTP POST                 │
         ▼                           │
┌─────────────────────────────────────────────────────────┐
│  External API (AWS ALB)                                 │
│  http://joyride-rewrite-alb-...amazonaws.com/trips      │
└─────────────────────────────────────────────────────────┘
```

### Data Flow:
1. **Rider books trip** → Rider client sends WebSocket message to server
2. **Server calls API** → Server calls external API (POST /trips) with trip data
3. **API responds** → API returns trip details with assigned driver
4. **Server notifies driver** → Server looks up driver by name and sends WebSocket message
5. **Server notifies rider** → Server sends trip details (with fare) to rider
6. **Driver responds** → Driver accepts/rejects via CLI
7. **Rider gets update** → Server notifies rider of acceptance/rejection

---

## Environment Variables

### Server
- `API_BASE_URL` - External API base URL (default: AWS ALB endpoint)
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)
- `REDIS_TLS` - Enable TLS (true/false)
- `SERVER_ID` - Server identifier

### Clients (Driver & Rider)
- `WEBSOCKET_SERVER` - Server host (default: localhost)
- `WEBSOCKET_PORT` - Server port (default: 3000)

Example:
```bash
WEBSOCKET_SERVER=54.169.75.241 npm run rider
```

---

## API Integration

### External API Endpoint
**URL:** `http://joyride-rewrite-alb-1006628052.ap-southeast-2.elb.amazonaws.com/trips`

### Request Format (create_trip action)
```json
{
  "action": "create_trip",
  "header": {},
  "data": {
    "rider": {
      "location": {
        "source": {
          "latitude": 14.5547,
          "longitude": 121.0244,
          "place_id": "bgc_001",
          "title": "Bonifacio Global City",
          "fullAddress": "Bonifacio Global City, Taguig, Metro Manila, Philippines"
        },
        "destination": {
          "latitude": 14.5547,
          "longitude": 121.0278,
          "place_id": "makati_001",
          "title": "Makati Central Business District",
          "fullAddress": "Makati Central Business District, Makati, Metro Manila, Philippines"
        }
      },
      "lastName": "Smith",
      "userId": "550e8400-e29b-41d4-a716-446655440001",
      "firstName": "Jane"
    }
  }
}
```

### Response Format
```json
{
  "message": "Trip Creation Successful.",
  "data": {
    "sk": "077fa353-d1a1-4d4f-9a45-5de3a1b0cb33",
    "rider": {
      "location": {
        "source": { ... },
        "destination": { ... }
      },
      "lastName": "Smith",
      "firstName": "Jane",
      "userId": "550e8400-e29b-41d4-a716-446655440001"
    },
    "fare": {
      "discountedFare": 0,
      "holidayFee": 0,
      "serviceCharge": 0,
      "surCharge": 0,
      "total": 49,
      "tripFare": 49
    },
    "metrics": {
      "source": { ... },
      "destination": { ... },
      "distance": {
        "value": 111.2,
        "text": "111.2 km"
      },
      "time": {
        "value": 167,
        "text": "167 min"
      },
      "provider": "shortest-distance"
    },
    "driver": {
      "userId": "639600487429",
      "firstName": "John",
      "lastName": "Doe",
      "location": {
        "latitude": 34.052235,
        "longitude": -118.243683
      }
    }
  }
}
```

---

## Action Router

The server supports multiple actions that map to external API calls:

| Action | HTTP Method | Endpoint | Status |
|--------|-------------|----------|--------|
| `create_trip` | POST | `/trips` | ✅ Implemented |
| `cancel_trip` | DELETE | `/trips` | 🔄 Extensible |
| `complete_trip` | PUT | `/trips` | 🔄 Extensible |

### How to Extend

Add new actions in `server.js`:

```javascript
const actionRouter = {
  'create_trip': {
    method: 'POST',
    endpoint: '/trips'
  },
  'cancel_trip': {
    method: 'DELETE',
    endpoint: '/trips'
  },
  'your_new_action': {
    method: 'PUT',
    endpoint: '/your-endpoint'
  }
};
```
---

## File Structure

```
joyride-websocket/
├── server.js                  # WebSocket server with action router
├── rider-client.js            # Rider CLI client (NEW)
├── driver-client.js           # Driver CLI client (NEW)
├── mock-data.js               # Mock riders, drivers, locations (NEW)
├── client.js                  # Original generic client
├── redis-publisher.js         # Redis publisher for external messages
├── package.json               # Dependencies and scripts
├── README.md                  # Original documentation
├── RIDER_DRIVER_GUIDE.md    
└── Dockerfile                 # Docker configuration
```

---

## Technical Details

### Server Event Handlers

| Event | Description | Emitted By |
|-------|-------------|------------|
| `assume-identity` | Register user as driver/rider | Client |
| `update-location` | Update user location | Client |
| `trip-request` | Request trip booking | Rider Client |
| `driver-response` | Accept/reject trip | Driver Client |
| `trip-created` | Trip successfully created | Server |
| `trip-error` | Trip booking error | Server |
| `trip-request-notification` | New trip for driver | Server |
| `driver-accepted` | Driver accepted trip | Server |
| `driver-rejected` | Driver rejected trip | Server |

### Server Tracking

The server maintains in-memory maps:

```javascript
onlineDrivers: Map<string, socketId>    // "John Doe" → "socket-abc123"
onlineRiders: Map<string, socketId>     // "Jane Smith" → "socket-xyz789"
userSockets: Map<socketId, userData>    // socketId → { type, userData, location }
tripToRider: Map<tripId, socketId>      // tripId → riderSocketId
```

---

## Testing Scenarios

### Scenario 1: Happy Path
1. Start server
2. Driver connects and assumes identity
3. Rider connects and books trip
4. Driver receives and accepts
5. Rider gets confirmation

**Expected:** All steps succeed, no errors

---

### Scenario 2: Driver Offline
1. Start server
2. Rider connects and books trip
3. API assigns offline driver

**Expected:**
- Server logs: `[ERROR] Driver John Doe is not online or not found`
- Rider still sees trip created but "waiting for driver"

---

### Scenario 3: Multiple Drivers
1. Start server
2. Connect 3 drivers (John Doe, Maria Santos, Pedro Cruz)
3. Rider books trip
4. API assigns one specific driver
5. Only that driver gets notification

**Expected:** Only the assigned driver sees the request

---

### Scenario 4: Driver Rejects
1. Complete booking flow
2. Driver types `2` (reject)

**Expected:**
- Rider sees rejection message
- System should assign another driver (handled by external API)

---

## Performance Considerations

- **In-memory storage**: All tracking is session-based, lost on server restart
- **No persistence**: Trips are not stored, managed by external API
- **Scalability**: For multiple server instances, use Redis adapter (already configured)
- **Timeout**: API calls timeout after 30 seconds

