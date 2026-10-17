import { test } from "node:test"
import assert from "node:assert/strict"
import { hostAllowed } from "./embed.js"

test("only 98ish's own pages may send starts", () => {
  assert.ok(hostAllowed("https://98ish.vercel.app"))
  assert.ok(hostAllowed("https://98ish-ovx29o7df-brandontaylor156s-projects.vercel.app"))
  assert.ok(hostAllowed("http://localhost:5173"))
  assert.ok(!hostAllowed("https://98ish.vercel.app.evil.com"))
  assert.ok(!hostAllowed("https://evil.com"))
  assert.ok(!hostAllowed(null))
})
