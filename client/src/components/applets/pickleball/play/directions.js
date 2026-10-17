// Directions to where you play: a real venue (My Park's VENUE_LIST, with Real Games' street
// addresses: pbclub/clubCore.js VENUES) or a Venue Finder court, as openMaps' options
// (utils/maps.js). Pure: no React.

import { VENUE_LIST } from "../park/venues/index.js"
import { VENUES as CLUB_VENUES } from "../../pbclub/clubCore.js"

const finite = (v) => typeof v === "number" && Number.isFinite(v)

// a real venue -> openMaps' options, or null
export const venueDirections = (id) => {
  const v = VENUE_LIST.find((x) => x.id === id)
  if (!v) return null
  const address = CLUB_VENUES.find((x) => x.id === id)?.address || v.city || ""
  return { name: v.name, lat: v.lat, lon: v.lon, address, directions: true }
}

// a place in the where & when sheet (places.js: real | live | arena) -> openMaps' options, or
// null (an arena is made up: nowhere to drive to)
export const placeDirections = (place) => {
  if (!place || place.kind === "arena") return null
  if (place.kind === "real") return venueDirections(place.id)
  return finite(place.lat) && finite(place.lon) ? { name: place.name, lat: place.lat, lon: place.lon, address: place.city || "", directions: true } : null
}
