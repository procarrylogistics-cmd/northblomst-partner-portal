# Keep Render awake (cold start fix)

Partners wait a long time when the free Render backend sleeps.
Use one of these keep-alive options.

## Option A — UptimeRobot (recommended, works now)

1. Create a free account at https://uptimerobot.com
2. Add **New Monitor**
   - Monitor Type: **HTTP(s)**
   - Friendly Name: `Northblomst backend`
   - URL: `https://northblomst-partner-portal-1.onrender.com/api/health`
   - Monitoring Interval: **5 minutes** (free) — better than 10
3. Save

This pings the backend regularly so Render is less likely to sleep.

## Option B — GitHub Actions every 10 minutes

File ready in repo: `.github/workflows/keep-render-awake.yml`

Push needs a GitHub Personal Access Token with **`workflow`** + **`repo`** scopes.
Then Actions → “Keep Render awake” will run on schedule (and can be run manually).

Optional repo variable: `BACKEND_HEALTH_URL`  
Default: `https://northblomst-partner-portal-1.onrender.com/api/health`

## If it still sleeps

Next steps: Render paid Starter (always on), or another always-on host.
