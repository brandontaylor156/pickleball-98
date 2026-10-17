# Pickleball 98: notes for the next session

A 90s-style 3D pickleball game (solo, online, My Park at real venues, Explore, Real Games,
tournaments, Twin Replay, Live Broadcast). It was a program inside 98ish
(github.com/brandontaylor156/98ish) and moved to this repo with its history in Oct 2026; 98ish
keeps a launcher icon that opens this site (98ish `client/src/utils/pickleballSite.js`, which
links here as `?mode=&venue=&place=`, read by `client/src/utils/deepLink.js`).

## Rules
- Never print the MongoDB connection string, tokens or any `.env` value.
- Free services only unless the owner says otherwise. Commit and push only when asked.
- Commit messages end with the Co-Authored-By / Claude-Session lines given in the session.
- Keep the Windows 98 look (98.css) inside the game, but no 98 window round it (no teal desktop, frame or blue title bar: that chrome is 98ish's, the launcher's; owner, Oct 2026). Baseline view first; the rest under **More options »** (`shared/MoreOptions.jsx`); the primary action stays on screen at 390x844.
- **Nothing moves your player for you** (owner's rule; never add auto-movement or offer it as a setting).
- Real venues: **nothing invented** (owner's rule): only what OSM, the aerial, photos or terrain data show, each with its source (`docs/venue-provenance.md`).
- Game loops measure time with `utils/frameClock.js` (keep `last` across frames, `reset()` only on restart).
- No accounts or passwords (owner's decision): a player is a unique name + a secret token kept on the device (`client/src/utils/player.js`, `server/players/`). There are no friends/buddies; cross-program social features from 98ish (Messenger, Buddy Locator, Couples, achievements, voice chat) were dropped.
- Anything new stored per player must be erased by `DELETE /api/players/me` (`server/players/index.js`).

## Layout
- `client/`: Vite + React app. `src/App.jsx` is the full-screen 98 window around `components/applets/pickleball/Pickleball.jsx`; `applets/pbclub/` (Real Games, tournaments UI); `src/roam/` (Explore / open world, `roam/host98.js` adapter); `api/osm.js`, `api/town.js` are Vercel functions.
- `server.js` + `server/`: Express + socket.io. `players` (names/tokens), `venues`, `pbclub`, `tourney`, `livingpark`, `park`, `roam`, `broadcast`, `net` (hello/list/invites + rooms), `arcade` (pickleball rooms), `voice` (park proximity voice relay).
- `tools/` venue, realball and roam builders; `docs/` per-area notes (read the matching one before changing an area: `pickleball-log.md` first).

## Run and test
- Server: `npm install && npm start` (PORT 8000). Without `MONGODB_URI` everything is kept in memory. `npm test`.
- Client: `cd client && npm install && npm run dev` (set `VITE_SOCKET_URL` to the server, default http://localhost:8000). `npm test`, `npm run build`.

## Owner decisions (Oct 2026)
- Living Park clones: every player at the venue sees and can challenge a clone while its owner is away.
- Live Broadcast: watched by link only.
- My Park "Together" activities (hold hands, date night, play with a pal) stay off until online multiplayer is working; then bring them back.
