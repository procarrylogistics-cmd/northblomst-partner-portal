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
