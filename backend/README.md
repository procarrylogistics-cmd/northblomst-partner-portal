# Northblomst Backend

API pentru Northblomst Partner Portal.

## Deploy pe Render (Web Service)

1. Creează Web Service, conectează repo GitHub
2. **Build & Deploy**
   - **Root Directory**: `backend` (dacă repo-ul e monorepo) sau lasă gol dacă backend e root
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` sau `node server.js`
   - **Runtime**: Node

3. **Environment Variables**
   - `NODE_ENV` = `production`
   - `PORT` – setat automat de Render
   - `MONGODB_URI` – connection string MongoDB Atlas
   - `JWT_SECRET` – secret pentru JWT (generat cu `openssl rand -hex 32`)
   - `CORS_ORIGIN` – URL frontend Vercel, ex: `https://northblomst-portal.vercel.app`

4. Health check: `GET /health` returnează `{ ok: true }`
