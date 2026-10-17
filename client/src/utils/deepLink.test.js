import { test } from "node:test"
import assert from "node:assert/strict"
import { handoffFromSearch } from "./deepLink.js"

test("98ish links become handoffs", () => {
  assert.deepEqual(handoffFromSearch("?mode=practice", 1), { id: 1, floppy: { mode: "practice", venue: null, place: null } })
  assert.deepEqual(handoffFromSearch("?mode=park&venue=loscab", 2), { id: 2, floppy: { mode: "park", venue: "loscab", place: null } })
  const place = { lat: 34.1, lon: -118.5, name: "Some Park" }
  assert.deepEqual(handoffFromSearch(`?venue=osm-1&place=${encodeURIComponent(JSON.stringify(place))}`, 3), { id: 3, floppy: { mode: "park", venue: "osm-1", place } })
})

test("nothing to start, or junk, gives no handoff", () => {
  assert.equal(handoffFromSearch(""), null)
  assert.equal(handoffFromSearch("?mode=hack"), null)
  assert.deepEqual(handoffFromSearch("?venue=x&place=%7Bnot-json", 4), { id: 4, floppy: { mode: "park", venue: "x", place: null } })
  assert.deepEqual(handoffFromSearch("?venue=x&place=%5B1%5D", 5).floppy.place, null)
})

test("Go Live's share link opens watching (old 98ish-style links too)", () => {
  assert.deepEqual(handoffFromSearch("?live=b12&code=K7QX", 6), { id: 6, live: "b12", code: "K7QX" })
  assert.deepEqual(handoffFromSearch("?open=program&name=Pickleball%2098&live=b12&code=K7QX", 7), { id: 7, live: "b12", code: "K7QX" })
  assert.deepEqual(handoffFromSearch("?live=b12&code=%3Cx%3E", 8), { id: 8, live: "b12", code: null })
  assert.equal(handoffFromSearch("?live=%3Cscript%3E"), null)
})
