# Shopify Webhooks – Instrucțiuni

## 1. Configurare .env

```env
SHOPIFY_STORE_DOMAIN=northblomst-dev.myshopify.com
SHOPIFY_ACCESS_TOKEN=<Admin API access token din custom app>
SHOPIFY_WEBHOOK_SECRET=<Client Secret - pentru verificare HMAC>
SHOPIFY_WEBHOOK_BASE_URL=https://xxxx.ngrok-free.app
```

- **SHOPIFY_ACCESS_TOKEN**: Custom app → Settings → API credentials → Admin API access token
- **SHOPIFY_WEBHOOK_SECRET**: Client Secret (același folosit pentru HMAC)
- **SHOPIFY_WEBHOOK_BASE_URL**: URL public unde rulează backend-ul (ngrok sau producție)

## 2. Scopes necesare

În Shopify Partner Dashboard → App → Settings → API scopes:

- `read_orders` – pentru orders/create, orders/updated, orders/cancelled
- `read_customers` – opțional
- `write_orders`, `write_fulfillments` – dacă actualizezi ordini din portal

Dacă primești 403 la setup webhooks: **Settings → API scopes → release new version → reinstall app** în store.

## 3. Test local cu ngrok

1. Pornește backend-ul:
   ```bash
   cd backend && npm run dev
   ```

2. În alt terminal, rulează ngrok:
   ```bash
   ngrok http 5000
   ```

3. Copiază URL-ul ngrok (ex: `https://abc123.ngrok-free.app`) în `.env`:
   ```env
   SHOPIFY_WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
   ```

4. Restartează backend-ul ca să ia noul SHOPIFY_WEBHOOK_BASE_URL.

5. Login ca admin în portal → Admin → buton **Setup Webhooks**.

6. Creează o comandă în Shopify dev store (northblomst-dev.myshopify.com).

7. Comanda ar trebui să apară în portal după câteva secunde. Verifică logurile backend-ului.

## 4. Topics înregistrate

- `orders/create` – comandă nouă → creează Order cu `createdByRole: 'shopify'`
- `orders/updated` – actualizare (note, tracking, fulfillment) → update Order
- `orders/cancelled` – anulare → `status: 'cancelled'`, `cancelledAt`, `cancelReason`

## 5. Troubleshooting

| Eroare | Cauză | Soluție |
|--------|--------|---------|
| 401 Invalid HMAC | SHOPIFY_WEBHOOK_SECRET greșit | Verifică Client Secret = SHOPIFY_WEBHOOK_SECRET |
| 403 la setup | Scopes lipsă | API scopes → adaugă read_orders → release → reinstall |
| 401 la setup | Token invalid | Regenerare Admin API token în custom app |
| Order nu apare | Webhook nu e înregistrat / ngrok oprit | Setup Webhooks din nou, verifică ngrok activ |

## 6. Producție

În loc de ngrok, folosește URL-ul real al backend-ului, ex.:

```env
SHOPIFY_WEBHOOK_BASE_URL=https://api.northblomst.dk
```
