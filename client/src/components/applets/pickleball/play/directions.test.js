// Directions from the where & when sheet. Run: node --test
import test from "node:test"
import assert from "node:assert/strict"
import { placeDirections, venueDirections } from "./directions.js"
import { VENUE_LIST } from "../park/venues/index.js"
import { VENUES as CLUB_VENUES } from "../../pbclub/clubCore.js"
import { placeById } from "./places.js"

test("Directions: real venues and Venue Finder courts, never an arena", () => {
  for (const v of VENUE_LIST) {
    const d = venueDirections(v.id)
    assert.equal(d.name, v.name)
    assert.ok(Number.isFinite(d.lat) && Number.isFinite(d.lon) && d.directions)
  }
  assert.equal(venueDirections("paseo").address, CLUB_VENUES.find((x) => x.id === "paseo").address)
  assert.equal(venueDirections("zzz"), null)
  assert.deepEqual(placeDirections(placeById("smash")), venueDirections("smash"))
  assert.equal(placeDirections(placeById("stadium")), null)
  assert.equal(placeDirections(placeById("park")), null)
  const live = placeById("ow77", { parkPlaces: { ow77: { id: "ow77", title: "Park Courts", lat: 34, lon: -118, town: "Somewhere" } } })
  assert.deepEqual(placeDirections(live), { name: "Park Courts", lat: 34, lon: -118, address: "Somewhere", directions: true })
})
