/**
 * Calculate the distance between two geographic coordinates using the Haversine formula.
 * @param {Array<number>} coords1 - Array [longitude, latitude] for the first location.
 * @param {Array<number>} coords2 - Array [longitude, latitude] for the second location.
 * @param {string} unit - Unit of distance ('km' or 'miles'). Defaults to 'km'.
 * @returns {number|string} - The distance in the specified unit or an error message.
 */
function calculateDistance(coords1, coords2, unit = 'km') {
    if (!Array.isArray(coords1) || !Array.isArray(coords2)) {
      return "Error: Coordinates must be arrays [longitude, latitude].";
    }
    if (coords1.length !== 2 || coords2.length !== 2) {
      return "Error: Each coordinate array must contain exactly two numbers.";
    }
  
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
  
    if (
      typeof lon1 !== 'number' || typeof lat1 !== 'number' ||
      typeof lon2 !== 'number' || typeof lat2 !== 'number'
    ) {
      return "Error: Coordinates must contain valid numbers.";
    }
  
    const R = unit === 'miles' ? 3958.8 : 6371.0;
    const toRadians = (degree) => (degree * Math.PI) / 180;
  
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
  
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance.toFixed(2);
  }
  
  module.exports = calculateDistance;
  