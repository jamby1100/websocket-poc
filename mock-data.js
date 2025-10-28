// Mock data for riders, drivers, and locations

const riders = [
  {
    userId: '550e8400-e29b-41d4-a716-446655440001',
    firstName: 'Jane',
    lastName: 'Smith',
    name: 'Jane Smith'
  },
  {
    userId: '550e8400-e29b-41d4-a716-446655440002',
    firstName: 'Lisa',
    lastName: 'Wong',
    name: 'Lisa Wong'
  },
  {
    userId: '550e8400-e29b-41d4-a716-446655440003',
    firstName: 'Mark',
    lastName: 'Garcia',
    name: 'Mark Garcia'
  },
  {
    userId: '550e8400-e29b-41d4-a716-446655440004',
    firstName: 'Sarah',
    lastName: 'Lee',
    name: 'Sarah Lee'
  }
];

const drivers = [
  {
    userId: '639600487429',
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe'
  },
  {
    userId: '639600487430',
    firstName: 'Maria',
    lastName: 'Santos',
    name: 'Maria Santos'
  },
  {
    userId: '639600487431',
    firstName: 'Pedro',
    lastName: 'Cruz',
    name: 'Pedro Cruz'
  },
  {
    userId: '639600487432',
    firstName: 'Ana',
    lastName: 'Reyes',
    name: 'Ana Reyes'
  },
  {
    userId: '639600487433',
    firstName: 'Carlos',
    lastName: 'Tan',
    name: 'Carlos Tan'
  }
];

const locations = [
  {
    name: 'BGC',
    place_id: 'bgc_001',
    title: 'Bonifacio Global City',
    fullAddress: 'Bonifacio Global City, Taguig, Metro Manila, Philippines',
    latitude: 34.052235,
    longitude: 35.052235
  },
  {
    name: 'Makati',
    place_id: 'oem335',
    title: 'Makati Central Business District',
    fullAddress: 'Makati Central Business District, Makati, Metro Manila, Philippines',
    latitude: 35.052235,
    longitude: -119.243783
  },
  {
    name: 'Ortigas',
    place_id: 'ortigas_001',
    title: 'Ortigas Center',
    fullAddress: 'Ortigas Center, Pasig, Metro Manila, Philippines',
    latitude: 14.5858,
    longitude: 121.0615
  },
  {
    name: 'QC Circle',
    place_id: 'qc_001',
    title: 'Quezon City Circle',
    fullAddress: 'Quezon Memorial Circle, Quezon City, Metro Manila, Philippines',
    latitude: 14.6513,
    longitude: 121.0497
  },
  {
    name: 'Manila Bay',
    place_id: 'manila_001',
    title: 'Manila Bay Area',
    fullAddress: 'Manila Bay, Manila, Metro Manila, Philippines',
    latitude: 14.5787,
    longitude: 120.9751
  },
  {
    name: 'Alabang',
    place_id: 'alabang_001',
    title: 'Alabang Town Center',
    fullAddress: 'Alabang Town Center, Muntinlupa, Metro Manila, Philippines',
    latitude: 14.4198,
    longitude: 121.0424
  },
  {
    name: 'MOA',
    place_id: 'moa_001',
    title: 'SM Mall of Asia',
    fullAddress: 'SM Mall of Asia, Pasay, Metro Manila, Philippines',
    latitude: 14.5362,
    longitude: 120.9822
  }
];

// Helper functions
function getRiders() {
  return riders;
}

function getDrivers() {
  return drivers;
}

function getLocations() {
  return locations;
}

function getRiderByName(name) {
  return riders.find(r => r.name.toLowerCase() === name.toLowerCase());
}

function getDriverByName(name) {
  return drivers.find(d => d.name.toLowerCase() === name.toLowerCase());
}

function getLocationByName(name) {
  return locations.find(l => l.name.toLowerCase() === name.toLowerCase());
}

module.exports = {
  riders,
  drivers,
  locations,
  getRiders,
  getDrivers,
  getLocations,
  getRiderByName,
  getDriverByName,
  getLocationByName
};
