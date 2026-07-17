# MonitorX Unified Platform — Run & Setup Guide

Four services make up the platform. All three frontends talk to the one backend
(REST + Socket.IO) on port **5000**.

| Service | Folder | Dev port | Login |
|---|---|---|---|
| Backend (API + WebSocket) | `Monitor-x/backend` | 5000 | — |
| Admin panel | `Monitor-x/frontend-vite` | 5173 | Credentials printed by the local seed command |
| Driver app | `Monitor-x/driver-web` | 5174 | phone (driver `contact`) + password |
| Employee app | `Monitor-x/employee-web` | 5175 | `empId` + default password |

## First-time setup

```bash
# Backend
cd Monitor-x/backend && npm install
# Frontends
cd ../frontend-vite && npm install
cd ../driver-web && npm install
cd ../employee-web && npm install
```

Each frontend has a `.env` with `VITE_API_URL=http://localhost:5000`.

## Backend environment variables

Required (in `Monitor-x/backend/.env`): `MONGODB_URI`, `JWT_SECRET`.

New optional variables (sensible defaults shown):

| Var | Default | Purpose |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173,5174,5175,127.0.0.1:5173,5174,5175` | Comma-separated production origins (REST + WS). Falls back to legacy `CORS_ORIGIN`; in development, any `localhost`/`127.0.0.1` Vite port is accepted. |
| `TRUST_PROXY` | empty | Number of trusted proxies in front of the API, commonly `1` in production. Required for correct IP rate limiting behind a load balancer. |
| `SEED_ADMIN_PASSWORD` | generated | Optional local-only admin seed password. |
| `SEED_STAFF_PASSWORD` | generated | Optional local-only staff seed password. |
| `DEFAULT_EMPLOYEE_PASSWORD` | generated | Optional local-only password seeded for every employee. |
| `SMS_PROVIDER` | `dev` | `dev` logs OTPs to the backend console. Set `fast2sms` to deliver real OTP SMS. |
| `FAST2SMS_API_KEY` | — | Required only when `SMS_PROVIDER=fast2sms`. Keep it in `backend/.env`; never expose it to a frontend. |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` / `MSG91_TEMPLATE_ID` | — | Required only when `SMS_PROVIDER=msg91`. |
| `SCHEDULE_ARRIVAL_BUFFER_MINUTES` | `5` | Pickup office-arrival safety buffer before login time. |
| `SCHEDULE_DRIVER_BUFFER_MINUTES` | `5` | Driver report/start-by buffer before route departure. |
| `SCHEDULE_STOP_DWELL_MINUTES` | `2` | Boarding/drop allowance added at every employee stop. |
| `LIVE_ETA_THROTTLE_MS` | `30000` | Minimum delay between GPS-based ETA calculations per driver. |
| `LIVE_ETA_NOTIFY_SECONDS` | `120` | Minimum ETA change that triggers an app update notification. |
| `GOOGLE_ROUTES_API_KEY` | — | Optional Google Routes API key for route-specific live traffic; the built-in time-of-day model is the fallback. |

## Seeding (DESTRUCTIVE — drops and recreates all collections)

```bash
cd Monitor-x/backend && npm run seed
```

This sets every employee's password to `DEFAULT_EMPLOYEE_PASSWORD` when it is
provided, otherwise it generates a random password. It leaves driver passwords
unset (drivers create theirs on first login). Development credentials are
printed once at the end; the seed refuses to run in production.

## Running (four terminals)

```bash
cd Monitor-x/backend && npm run dev          # :5000  (API + WebSocket)
cd Monitor-x/frontend-vite && npm run dev     # :5173  (admin)
cd Monitor-x/driver-web && npm run dev         # :5174  (driver)
cd Monitor-x/employee-web && npm run dev       # :5175  (employee)
```

## End-to-end test flow (dev-mode OTP)

1. **Driver first login:** open `:5174` → "First time? Set password" → enter a
   seeded driver phone (the seed prints one, e.g. the first driver's `contact`)
   and a password.
2. **Employee login:** open `:5175` → `EMP001` / the generated employee password printed by the seed.
3. **Freeze a trip:** in the admin (`:5173`) Trip Management, freeze a frozen-eligible
   trip whose driver = your test driver → driver app shows it instantly; employee
   app shows driver + vehicle.
4. **OTP pickup:** in the driver app open the trip → "Send OTP" for an employee →
   the employee app shows the 6-digit code (also logged in the backend console) →
   enter it in the driver app → "Verify" → employee shows ✓ on both apps and in
   the admin's expanded trip row.
5. **Start trip:** once all verified, driver taps "Start Trip" → admin + employee
   see "Trip Started" live.
6. **SOS:** employee taps the red SOS button → confirm → a full-screen red popup
   appears on the admin and on the driver app. Admin clicks "Acknowledge" to clear
   it everywhere.
7. **Complete:** driver taps "End Trip" → status "Completed" everywhere.
8. **Forgot password:** driver app → "Forgot password" → enter phone → OTP printed
   to console / shown as a dev toast → reset.

## Fast2SMS OTP delivery

Create `Monitor-x/backend/.env` from `.env.example` and add the following. The
file is git-ignored, so the key stays local to the backend:

```env
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your_fast2sms_key
```

Restart the backend after changing the environment. Fast2SMS requires a valid
account, an enabled OTP API route, and sufficient wallet/KYC status; the API
will return the provider error to the OTP request if any of those are missing.
Both login/reset and employee pickup OTPs use this same provider integration.

## Production deployment checklist

- Set `NODE_ENV=production` and generate a unique `JWT_SECRET` of at least 32 random characters.
- Use only HTTPS URLs in `CORS_ORIGINS`; production startup rejects HTTP origins.
- Terminate TLS at a managed load balancer/reverse proxy and set `TRUST_PROXY` to its trusted hop count.
- Use a MongoDB replica set/managed cluster with authentication, encryption, automated backups and tested point-in-time restore.
- Configure a real SMS provider and its required credentials; development SMS mode is rejected in production.
- Route `GET /api/health/live` to the liveness probe and `GET /api/health/ready` to readiness. Readiness returns 503 until MongoDB connects.
- Store secrets in the deployment secret manager, never in frontend `VITE_*` variables or committed `.env` files.
- Retain structured application logs with access controls and alerts for repeated 401/403/429/5xx responses.
- Put uploaded employee documents behind an approved malware-scanning/object-storage service before accepting untrusted external uploads at scale.
- Exercise database restore, company suspension, account revocation, OTP delivery and graceful SIGTERM shutdown in staging before release.
