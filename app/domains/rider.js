class Rider {
  constructor(data = {}) {
    this.data = {
      riderId: data.riderId || data.userId || null,
      userId: data.userId || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      phoneNumber: data.phoneNumber || null,
      currentLocation: data.currentLocation || null,
      rating: data.rating || 0,
      status: data.status || 'idle' // idle, booking, in_trip, completed
    };
  }

  // Business logic methods
  getFullName() {
    return `${this.data.firstName || ''} ${this.data.lastName || ''}`.trim();
  }

  isIdle() {
    return this.data.status === 'idle';
  }

  isBooking() {
    return this.data.status === 'booking';
  }

  isInTrip() {
    return this.data.status === 'in_trip';
  }

  setStatus(status) {
    const validStatuses = ['idle', 'booking', 'in_trip', 'completed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    this.data.status = status;
  }

  updateLocation(location) {
    if (!location || !location.latitude || !location.longitude) {
      throw new Error('Location must have latitude and longitude');
    }
    this.data.currentLocation = location;
  }

  setRating(rating) {
    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      throw new Error('Rating must be a number between 0 and 5');
    }
    this.data.rating = rating;
  }

  canBook() {
    if (!this.data.userId) {
      throw new Error('Rider must have a user ID to book a trip');
    }
    if (!this.data.firstName || !this.data.lastName) {
      throw new Error('Rider must have first name and last name to book a trip');
    }
    return true;
  }

  createTripPayload(sourceLocation, destinationLocation) {
    this.canBook();

    if (!sourceLocation || !destinationLocation) {
      throw new Error('Source and destination locations are required');
    }

    // Support both Location instances and plain objects
    const sourceData = sourceLocation.data || sourceLocation;
    const destData = destinationLocation.data || destinationLocation;

    return {
      location: {
        source: {
          latitude: sourceData.latitude,
          longitude: sourceData.longitude,
          place_id: sourceData.place_id,
          title: sourceData.title,
          fullAddress: sourceData.fullAddress
        },
        destination: {
          latitude: destData.latitude,
          longitude: destData.longitude,
          place_id: destData.place_id,
          title: destData.title,
          fullAddress: destData.fullAddress
        }
      },
      lastName: this.data.lastName,
      userId: this.data.userId,
      firstName: this.data.firstName
    };
  }

  // Static factory methods
  static fromData(riderData) {
    return new Rider(riderData);
  }

  static fromArray(ridersArray) {
    return ridersArray.map(riderData => new Rider(riderData));
  }
}

module.exports = Rider;
