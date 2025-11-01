class Location {
  constructor(data = {}) {
    this.data = {
      name: data.name || null,
      place_id: data.place_id || null,
      title: data.title || null,
      fullAddress: data.fullAddress || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null
    };
  }

  // Business logic methods
  getCoordinates() {
    return {
      latitude: this.data.latitude,
      longitude: this.data.longitude
    };
  }

  getDisplayName() {
    return this.data.title || this.data.name;
  }

  getShortName() {
    return this.data.name;
  }

  isValid() {
    return this.data.latitude !== null &&
           this.data.longitude !== null &&
           this.data.place_id !== null;
  }

  hasCoordinates() {
    return this.data.latitude !== null && this.data.longitude !== null;
  }

  // Calculate distance to another location in kilometers
  distanceTo(otherLocation) {
    if (!this.hasCoordinates() || !otherLocation.hasCoordinates()) {
      throw new Error('Both locations must have valid coordinates');
    }

    const R = 6371; // Earth's radius in kilometers
    const lat1 = this.data.latitude;
    const lon1 = this.data.longitude;
    const lat2 = otherLocation.data.latitude;
    const lon2 = otherLocation.data.longitude;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance;
  }

  // Create a location payload for API requests
  toPayload() {
    return {
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      place_id: this.data.place_id,
      title: this.data.title,
      fullAddress: this.data.fullAddress
    };
  }

  // Format location for display
  formatForDisplay() {
    return {
      name: this.data.title || this.data.name,
      address: this.data.fullAddress,
      coordinates: `(${this.data.latitude}, ${this.data.longitude})`
    };
  }

  // Static factory methods
  static fromData(locationData) {
    return new Location(locationData);
  }

  static fromArray(locationsArray) {
    return locationsArray.map(locationData => new Location(locationData));
  }

  static fromCoordinates(latitude, longitude, additionalData = {}) {
    return new Location({
      latitude,
      longitude,
      ...additionalData
    });
  }

  static computeFare(sourceLat, sourceLon, destLat, destLon) {
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
    }
  }
}

module.exports = Location;
