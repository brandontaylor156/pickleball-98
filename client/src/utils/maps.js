// Directions to a court: opens the device's maps in a new tab (Google Maps' universal link,
// which hands off to the Google Maps or Apple Maps app on a phone).
//
//   openMaps({ name: "Los Cab Sports Village", lat: 33.7173, lon: -117.9861, directions: true })
//
// - name (optional): what the place is called
// - lat, lon (required): where it is (WGS84 degrees)
// - directions (optional): true opens straight into directions from where you are
// - mode (optional): "drive" (default), "walk" or "bike"
// Returns false (and opens nothing) when lat/lon aren't a real place.

const TRAVEL = { drive: "driving", walk: "walking", bike: "bicycling" }

export const mapsUrl = ({ name = "", lat, lon, directions = false, mode } = {}) => {
  const la = Number(lat)
  const lo = Number(lon)
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null
  const at = `${la},${lo}`
  if (directions) return `https://www.google.com/maps/dir/?api=1&destination=${at}&travelmode=${TRAVEL[mode] || "driving"}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name ? `${name} ${at}` : at)}`
}

export const openMaps = (place = {}) => {
  const url = mapsUrl(place)
  if (!url) return false
  window.open(url, "_blank", "noopener")
  return true
}
