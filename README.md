# MonitorX — Transport Management System

A complete employee-transport management platform: an admin control panel, a mobile-web
app for employees, a mobile-web app for drivers, and a real-time backend.

## Applications

| App | Path | Default port | Purpose |
|-----|------|--------------|---------|
| Backend API | `Monitor-x/backend` | 5000 | Express + MongoDB + Socket.IO (REST + realtime) |
| Admin panel | `Monitor-x/frontend-vite` | 5173 | Planning, monitoring, masters, tracking, reports |
| Driver app | `Monitor-x/driver-web` | 5174 | Trips, OTP passenger verification, phone-as-GPS tracking |
| Employee app | `Monitor-x/employee-web` | 5175 | Trips, SOS, share live location, address-change requests |

## Features

- **Route management** — company location + logo + vendor list, route CRUD with
  geocoded destinations and road-path previews (OSRM), max 7 colour-coded routes.
- **Master routing map** — routes drawn along real roads from the office to each
  destination; employees plotted as colour-coded pins; auto-assignment of each
  employee to the nearest route from their geocoded home address (PIN-code and
  locality-anchored geocoding via Nominatim + Photon).
- **Rostering** — per-employee login/logout shift grid with right-click removal.
- **Trip management** — rostered groups become trips by picking a vehicle; shift-time
  filtering; vehicle changeable before lock (and at any status from Live Trip Monitor,
  with reports reflecting the change); trip freeze dispatches to the driver app.
- **Live trip monitor** — status boards, live employee location shares, vehicle change.
- **Vehicle tracking** — the driver's phone acts as the GPS device (tracking key,
  position pings, wake-lock) and vehicles move live on the admin map. No paid APIs.
- **Safety** — employee SOS with photo/reason, SMS alert number, admin acknowledge;
  live employee-location panel on the dashboard.
- **People & fleet masters** — employees (Excel import/export, documents, bulk delete),
  drivers (Aadhaar/PAN, Excel import, bulk delete), vehicles, staff accounts with
  admin/staff roles, notifications bell, feedback, reports.

## Tech stack

Node.js · Express · MongoDB (Mongoose) · Socket.IO · React 18 · Vite · TypeScript ·
Tailwind CSS · react-leaflet / OpenStreetMap · xlsx

## Getting started

Prerequisites: Node.js 18+, and MongoDB (local) or a MongoDB Atlas connection string.

```bash
# 1. Backend
cd Monitor-x/backend
cp .env.example .env        # set MONGODB_URI (+ optional SMS provider keys)
npm install
npm run seed                # optional: demo data + admin user
npm run dev                 # http://localhost:5000

# 2. Admin panel
cd ../frontend-vite && npm install && npm run dev    # http://localhost:5173

# 3. Driver app
cd ../driver-web && npm install && npm run dev       # http://localhost:5174

# 4. Employee app
cd ../employee-web && npm install && npm run dev     # http://localhost:5175
```

Seeded admin login: `admin@monitorx.com` / `Admin@123` (change it in production).
Drivers log in with their phone number via OTP (dev mode prints the code unless an
SMS provider is configured in `.env`); employees log in with employee ID + password.

## Notes

- Browser geolocation (driver GPS, employee location share) requires HTTPS in
  production; `localhost` works for development.
- Free external services used: OpenStreetMap tiles, Nominatim + Photon geocoding,
  OSRM routing — no API keys required.
