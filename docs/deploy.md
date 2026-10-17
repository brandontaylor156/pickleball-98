# Deploying Pickleball 98

Three free services: the site on Vercel, the server on Render, the database on MongoDB Atlas.

## 1. Database (MongoDB Atlas, free M0)
1. Create a free account at mongodb.com/atlas and a free **M0** cluster.
2. Database Access: add a user with a generated password.
3. Network Access: allow `0.0.0.0/0` (Render's free plan has no fixed IP).
4. Connect › Drivers: copy the connection string, put the password in, and add a database
   name before the `?` (for example `.../pickleball98?retryWrites=true...`). Keep it private.

## 2. Server (Render, free web service)
1. Render › New › Blueprint, pick the GitHub repo; it reads `render.yaml`.
2. When asked, paste the Atlas string as `MONGODB_URI`.
3. After the deploy, opening the service's address shows "Pickleball 98 server is running".
   Free services sleep after 15 idle minutes; `server.js` keeps itself awake on Render.
4. Optional env vars: TURN relay for park voice (`CLOUDFLARE_TURN_*`, `METERED_TURN_*` or
   `TURN_*`), venue limits (`OVERPASS_URL`, `VENUES_*`), `WEB_MONTHLY_TOTAL_MB`.

## 3. Site (Vercel)
1. Vercel › Add New › Project › import the repo. **Root Directory: `client`** (framework Vite).
2. Environment variable `VITE_SOCKET_URL` = the Render address (https://...onrender.com).
3. Deploy. Then in 98ish set `VITE_PICKLEBALL_URL` to this site's address (98ish's
   `client/src/utils/pickleballSite.js`) so its launcher icon opens it.
4. Keep an eye on Vercel usage (`vercel usage --group-by project`): Explore's `/api/town` and
   Venue Finder's `/api/osm` are serverless functions and count toward the plan.
