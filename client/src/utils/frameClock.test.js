import { test } from "node:test"
import assert from "node:assert/strict"
import { FRAME_MS, MAX_FRAME_MS, createFrameClock, substeps } from "./frameClock.js"

test("frame clock: real time between frames, kept across frames", () => {
  const c = createFrameClock()
  assert.equal(c.tick(1000), FRAME_MS)
  assert.equal(c.first, true)
  assert.equal(c.tick(1033), 33)
  assert.equal(c.first, false)
  assert.equal(c.tick(1041), 8)
})

test("frame clock: a stall is clamped, time never runs backwards, reset starts afresh", () => {
  const c = createFrameClock()
  c.tick(0)
  assert.equal(c.tick(5000), MAX_FRAME_MS)
  assert.equal(c.tick(4990), 0)
  c.reset()
  assert.equal(c.running, false)
  assert.equal(c.tick(9000), FRAME_MS)
  assert.equal(c.first, true)
})

test("substeps: none longer than the max step", () => {
  assert.equal(substeps(0.1, 1 / 60), 6)
  assert.equal(substeps(1 / 60, 1 / 60), 1)
  assert.equal(substeps(0, 1 / 60), 1)
})
