// Curated list of major cities for quick birth-place selection. UTC offsets
// are standard-time approximations (DST is not modeled) — good enough for a
// convenience preset; users can switch to "Custom" for exact values.

export interface CityLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number; // + East, - West
  utcOffsetHours: number;
}

export const CITIES: CityLocation[] = [
  { name: "Kingston", country: "Jamaica", latitude: 17.9712, longitude: -76.7936, utcOffsetHours: -5 },
  { name: "Montego Bay", country: "Jamaica", latitude: 18.4762, longitude: -77.8939, utcOffsetHours: -5 },
  { name: "New York", country: "USA", latitude: 40.7128, longitude: -74.0060, utcOffsetHours: -5 },
  { name: "Los Angeles", country: "USA", latitude: 34.0522, longitude: -118.2437, utcOffsetHours: -8 },
  { name: "Chicago", country: "USA", latitude: 41.8781, longitude: -87.6298, utcOffsetHours: -6 },
  { name: "Miami", country: "USA", latitude: 25.7617, longitude: -80.1918, utcOffsetHours: -5 },
  { name: "Houston", country: "USA", latitude: 29.7604, longitude: -95.3698, utcOffsetHours: -6 },
  { name: "Atlanta", country: "USA", latitude: 33.7490, longitude: -84.3880, utcOffsetHours: -5 },
  { name: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832, utcOffsetHours: -5 },
  { name: "Mexico City", country: "Mexico", latitude: 19.4326, longitude: -99.1332, utcOffsetHours: -6 },
  { name: "Bogotá", country: "Colombia", latitude: 4.7110, longitude: -74.0721, utcOffsetHours: -5 },
  { name: "São Paulo", country: "Brazil", latitude: -23.5505, longitude: -46.6333, utcOffsetHours: -3 },
  { name: "Port of Spain", country: "Trinidad & Tobago", latitude: 10.6549, longitude: -61.5019, utcOffsetHours: -4 },
  { name: "Nassau", country: "Bahamas", latitude: 25.0343, longitude: -77.3963, utcOffsetHours: -5 },
  { name: "Bridgetown", country: "Barbados", latitude: 13.1132, longitude: -59.5988, utcOffsetHours: -4 },
  { name: "London", country: "UK", latitude: 51.5074, longitude: -0.1278, utcOffsetHours: 0 },
  { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522, utcOffsetHours: 1 },
  { name: "Berlin", country: "Germany", latitude: 52.5200, longitude: 13.4050, utcOffsetHours: 1 },
  { name: "Madrid", country: "Spain", latitude: 40.4168, longitude: -3.7038, utcOffsetHours: 1 },
  { name: "Rome", country: "Italy", latitude: 41.9028, longitude: 12.4964, utcOffsetHours: 1 },
  { name: "Lisbon", country: "Portugal", latitude: 38.7223, longitude: -9.1393, utcOffsetHours: 0 },
  { name: "Lagos", country: "Nigeria", latitude: 6.5244, longitude: 3.3792, utcOffsetHours: 1 },
  { name: "Accra", country: "Ghana", latitude: 5.6037, longitude: -0.1870, utcOffsetHours: 0 },
  { name: "Nairobi", country: "Kenya", latitude: -1.2921, longitude: 36.8219, utcOffsetHours: 3 },
  { name: "Cairo", country: "Egypt", latitude: 30.0444, longitude: 31.2357, utcOffsetHours: 2 },
  { name: "Johannesburg", country: "South Africa", latitude: -26.2041, longitude: 28.0473, utcOffsetHours: 2 },
  { name: "Dubai", country: "UAE", latitude: 25.2048, longitude: 55.2708, utcOffsetHours: 4 },
  { name: "Mumbai", country: "India", latitude: 19.0760, longitude: 72.8777, utcOffsetHours: 5.5 },
  { name: "Delhi", country: "India", latitude: 28.7041, longitude: 77.1025, utcOffsetHours: 5.5 },
  { name: "Karachi", country: "Pakistan", latitude: 24.8607, longitude: 67.0011, utcOffsetHours: 5 },
  { name: "Dhaka", country: "Bangladesh", latitude: 23.8103, longitude: 90.4125, utcOffsetHours: 6 },
  { name: "Bangkok", country: "Thailand", latitude: 13.7563, longitude: 100.5018, utcOffsetHours: 7 },
  { name: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198, utcOffsetHours: 8 },
  { name: "Manila", country: "Philippines", latitude: 14.5995, longitude: 120.9842, utcOffsetHours: 8 },
  { name: "Hong Kong", country: "China", latitude: 22.3193, longitude: 114.1694, utcOffsetHours: 8 },
  { name: "Shanghai", country: "China", latitude: 31.2304, longitude: 121.4737, utcOffsetHours: 8 },
  { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503, utcOffsetHours: 9 },
  { name: "Seoul", country: "South Korea", latitude: 37.5665, longitude: 126.9780, utcOffsetHours: 9 },
  { name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093, utcOffsetHours: 10 },
  { name: "Auckland", country: "New Zealand", latitude: -36.8485, longitude: 174.7633, utcOffsetHours: 12 },
];
