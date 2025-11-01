class Driver {
  constructor(data = {}) {
    this.data = {
      driverId: data.driverId || data.userId || null,
      name: data.name || null,
      userId: data.userId || null,
      phoneNumber: data.phoneNumber || null,
      vehicleInfo: data.vehicleInfo || null,
      rating: data.rating || 0,
      status: data.status || 'available', // available, busy, offline
      currentLocation: data.currentLocation || null
    };
  }

  // Business logic methods
  isAvailable() {
    return this.data.status === 'available';
  }

  isBusy() {
    return this.data.status === 'busy';
  }

  isOffline() {
    return this.data.status === 'offline';
  }

  setStatus(status) {
    const validStatuses = ['available', 'busy', 'offline'];
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

  // Static factory methods
  static fromData(driverData) {
    return new Driver(driverData);
  }

  static fromArray(driversArray) {
    return driversArray.map(driverData => new Driver(driverData));
  }
}

module.exports = Driver;
