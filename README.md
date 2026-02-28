# Northblomst Partner Portal

React frontend + Node/Express backend + MongoDB.

## Local development

```bash
# Terminal 1 – backend
cd backend && npm run dev

# Terminal 2 – frontend
cd frontend && npm run dev
```

**Default login (auto-created in dev if DB empty):**
- Admin: `admin@northblomst.dk` / `admin123`

## Deploy

### Backend (Render)
- Root: `backend` (dacă monorepo) sau repo separat
- Build: `npm install`
- Start: `npm start`
- Env: `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`

### Frontend (Vercel)
- Framework: Vite
- Build: `npm run build` (din folder `frontend`)
- Env: `VITE_API_BASE_URL` = URL backend Render

### După deploy
1. Setează `CORS_ORIGIN` în backend = URL Vercel (ex: `https://xxx.vercel.app`)
2. Setează `VITE_API_BASE_URL` în frontend = URL Render (ex: `https://xxx.onrender.com`)

## Backfill deliveryDate

Pentru ordere salvate înainte de extragerea corectă a `deliveryDate`:

**Local:**
```bash
cd backend && npm run backfill-delivery-date
```

**Render (producție):** apelează endpoint-ul admin:
```bash
curl -X POST https://northblomst-partner-portal-1.onrender.com/api/admin/backfill-delivery-date \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Cookie: nb_token=<TOKEN>"
```
sau din Admin portal (dacă există buton) sau Rulează scriptul local conectat la MongoDB producție (MONGODB_URI din Render).
