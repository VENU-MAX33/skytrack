# MonitorX Unified Platform — Run & Setup Guide

Four services make up the platform. All three frontends talk to the one backend
(REST + Socket.IO) on port **5000**.

| Service | Folder | Dev port | Login |
|---|---|---|---|
| Backend (API + WebSocket) | `Monitor-x/backend` | 5000 | — |
| Admin panel | `Monitor-x/frontend-vite` | 5173 | `admin@monitorx.com` / `Admin@123` |
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
| `CORS_ORIGINS` | `http://localhost:5173,5174,5175` | Comma-separated allowed origins (REST + WS). Falls back to legacy `CORS_ORIGIN`. |
| `DEFAULT_EMPLOYEE_PASSWORD` | `monitorx@123` | Shared password seeded for every employee. |
| `SMS_PROVIDER` | `dev` | `dev` logs OTPs to console + emits over WebSocket. `msg91` for real SMS. |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` / `MSG91_TEMPLATE_ID` | — | Required only when `SMS_PROVIDER=msg91`. |

## Seeding (DESTRUCTIVE — drops and recreates all collections)

```bash
cd Monitor-x/backend && npm run seed
```

This sets every employee's password to `DEFAULT_EMPLOYEE_PASSWORD` and leaves
driver passwords unset (drivers create theirs on first login). The seed prints
example logins at the end.

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
2. **Employee login:** open `:5175` → `EMP001` / `monitorx@123`.
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

## Real SMS later

Set `SMS_PROVIDER=msg91` and the `MSG91_*` vars, then implement the TODO in
`backend/src/services/otp.service.ts > deliverSms()`. No other code changes are
needed — both the pickup OTP and the driver password-reset OTP route through that
single function.
