const Location = require('./location');

class Trip {
  constructor(data = {}) {
    console.log("And we're getting data like...")
    console.log(data)

    this.data = {
      tripId: data.tripId || null,
      status: data.status || 'pending', // pending, looking_for_driver, accepted, in_progress, completed, cancelled
      rider: data.rider || null,
      driver: data.driver || null,
      fare: data.fare || null,
      tip: data.tip || 0,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      // For pending bookings
      sourceLocation: data.sourceLocation || null,
      destLocation: data.destLocation || null,
      payload: data.payload || null,
      sendTime: data.sendTime || null
    };
  }

  // Status check methods
  isPending() {
    return this.data.status === 'pending' && this.data.sendTime !== null;
  }

  isLookingForDriver() {
    return this.data.status === 'looking_for_driver';
  }

  isAccepted() {
    return this.data.status === 'accepted';
  }

  isInProgress() {
    return this.data.status === 'in_progress';
  }

  isCompleted() {
    return this.data.status === 'completed';
  }

  isCancelled() {
    return this.data.status === 'cancelled';
  }

  isActive() {
    const activeStatuses = ['pending', 'looking_for_driver', 'accepted', 'in_progress'];
    return activeStatuses.includes(this.data.status);
  }

  // Business logic methods
  setStatus(status) {
    const validStatuses = ['pending', 'looking_for_driver', 'accepted', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    this.data.status = status;
    this.data.updatedAt = new Date().toISOString();
  }

  addTip(tipAmount) {
    const tip = parseFloat(tipAmount);
    if (isNaN(tip) || tip < 0) {
      throw new Error('Invalid tip amount. Must be a positive number.');
    }
    this.data.tip = tip;
    this.data.updatedAt = new Date().toISOString();

    // Update payload if exists (for pending bookings)
    if (this.data.payload && this.data.payload.data) {
      if (!this.data.payload.data.tip) {
        this.data.payload.data.tip = 0;
      }
      this.data.payload.data.tip = tip;
    }
  }

  getTotalAmount() {
    const baseFare = this.getBaseFare();
    const tip = this.data.tip || 0;
    return baseFare + tip;
  }

  getBaseFare() {
    console.log("And the data fare is:")
    console.log(this.data.fare)

    if (this.data.fare && this.data.fare.total !== undefined) {
      return this.data.fare.total;
    }

    return 0;
  }

  getSourceLocation() {
    let locationData = null;
    if (this.data.sourceLocation) {
      locationData = this.data.sourceLocation;
    } else if (this.data.rider && this.data.rider.location && this.data.rider.location.source) {
      locationData = this.data.rider.location.source;
    }
    return locationData ? new Location(locationData) : null;
  }

  getDestinationLocation() {
    let locationData = null;
    if (this.data.destLocation) {
      locationData = this.data.destLocation;
    } else if (this.data.rider && this.data.rider.location && this.data.rider.location.destination) {
      locationData = this.data.rider.location.destination;
    }
    return locationData ? new Location(locationData) : null;
  }

  getRemainingSeconds() {
    if (!this.data.sendTime) return 0;
    return Math.ceil((this.data.sendTime - Date.now()) / 1000);
  }

  isOverdue() {
    return this.getRemainingSeconds() < 0;
  }

  update(updates) {
    this.data = {
      ...this.data,
      ...updates,
      updatedAt: new Date().toISOString()
    };
  }

  // Static factory methods
  static fromTripCreatedEvent(eventData) {
    return new Trip({
      tripId: eventData.tripId,
      status: 'looking_for_driver',
      rider: eventData.rider,
      driver: eventData.driver || null,
      fare: eventData.fare,
      tip: eventData.tip || 0
    });
  }

  static createPendingBooking(payload, sourceLocation, destLocation, fare, currentRider, sendTime) {
    // Support both Location instances and plain objects
    const sourceData = sourceLocation.data || sourceLocation;
    const destData = destLocation.data || destLocation;

    console.log("And we are getting data at createPendingBooking like...")
    console.log(fare)

    return new Trip({
      status: 'pending',
      payload: payload,
      sourceLocation: sourceData,
      destLocation: destData,
      fare: fare,
      sendTime: sendTime,
      rider: currentRider,
      tip: payload.data.tip || 0
    });
  }

  static fromData(tripData) {
    return new Trip(tripData);
  }
}

module.exports = Trip;
