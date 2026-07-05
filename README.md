# Event Management & Online Booking Website


A full-stack web application for managing events and electronic ticket reservations, built per the assignment specification (welcome page → registration with admin approval → role-based dashboards → event CRUD with capacity validation → search & booking → messaging → admin XML/JSON export → BMF recommendations).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · TypeScript · Vite · React Router v6 · Leaflet (OpenStreetMap) |
| Backend  | Node.js · Express · TypeScript · Prisma ORM |
| Database | PostgreSQL |
| Auth     | JWT (bcrypt for password hashing) |
| Transport| HTTPS (TLS/SSL — optional) |

## User Roles

- **Administrator** — pre-installed (`admin` / `admin123`); approves user registrations; exports events as XML/JSON
- **Organizer** — any approved user; creates and manages events
- **Participant** — any approved user; browses and books events
- **Guest** — unauthenticated visitor; can browse & search but not book

## Prerequisites

1. **Node.js ≥ 18** (tested with v24)
2. **Docker Desktop** — used to run PostgreSQL. Start it before running setup.
   *(If you prefer a native Postgres install, skip the Docker steps and edit `backend/.env` to point at your own database.)*

## One-Time Setup

```bash
npm install      # installs root tooling (concurrently, helper scripts)
npm run setup    # creates .env, installs backend+frontend deps, starts Postgres, runs migrations, seeds demo data
```

## Run Everything

```bash
npm start
```

This boots Postgres (if not already running), waits for it to be ready, and starts the backend (`http://localhost:4000`) **and** frontend (`http://localhost:5173`) together with colored output. Press `Ctrl+C` once to stop both.

Open <http://localhost:5173> and log in with one of the seed accounts below.

## All Root Scripts

| Command | What it does |
|---|---|
| `npm install` | Install root tooling (concurrently) |
| `npm run setup` | One-time: env file, deps, Postgres up, migrate, seed |
| `npm start` | Daily: Postgres up + backend + frontend in parallel |
| `npm run dev` | Backend + frontend in parallel (assumes Postgres already up) |
| `npm run build` | Build both backend and frontend for production |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run db:reset` | Wipe the database and re-run migrations + seed |
| `npm run db:seed` | Re-seed (without wiping) |
| `npm run train` | Retrain the BMF recommender on current data |
| `npm run test:recommender` | Run the synthetic-dataset sanity test for the recommender |
| `npm run eval:recommender` | Train & evaluate the BMF on the provided dataset (RMSE + ranking) |

## Default Accounts (after seed)

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Administrator |
| `organizer1` | `organizer123` | Approved user (organizer of seed event) |
| `user1` | `user123` | Approved user (can book) |

## Enabling HTTPS

The backend supports HTTPS out of the box. See [`backend/generate-certs.md`](./backend/generate-certs.md) for generating a self-signed certificate. Then in `.env`:

```
USE_HTTPS=true
SSL_KEY_PATH=./certs/key.pem
SSL_CERT_PATH=./certs/cert.pem
```

## REST API Endpoints

All `/api/*` endpoints (except `/auth/*` and the public `GET /events*`) require a valid JWT in the `Authorization: Bearer <token>` header. Role-based authorization is enforced server-side.

| Method | Path | Role |
|---|---|---|
| `POST` | `/api/auth/register` | public |
| `POST` | `/api/auth/login` | public |
| `GET`  | `/api/auth/me` | authenticated |
| `GET`  | `/api/events` (paginated, filters) | public |
| `GET`  | `/api/events/categories` | public |
| `GET`  | `/api/events/:id` | public |
| `POST` | `/api/events` | user |
| `PUT`  | `/api/events/:id` | organizer of event |
| `DELETE` | `/api/events/:id` | organizer of event (only DRAFT or no bookings) |
| `POST` | `/api/events/:id/publish` | organizer of event |
| `POST` | `/api/events/:id/cancel` | organizer of event |
| `GET`  | `/api/events/mine` | user |
| `GET`  | `/api/events/:id/bookings` | organizer of event |
| `POST` | `/api/events/:id/photos` | organizer of event (multipart/form-data) |
| `DELETE` | `/api/events/:id/photos/:photoId` | organizer of event |
| `POST` | `/api/events/:id/bookings` | user (not organizer) |
| `GET`  | `/api/bookings/mine` | user |
| `GET`  | `/api/messages/inbox` | user |
| `GET`  | `/api/messages/sent` | user |
| `GET`  | `/api/messages/unread-count` | user |
| `POST` | `/api/messages` | user |
| `POST` | `/api/messages/:id/read` | user |
| `DELETE` | `/api/messages/:id?box=inbox\|sent` | user |
| `GET`  | `/api/recommendations?n=6` | user |
| `POST` | `/api/recommendations/retrain` | admin |
| `GET`  | `/api/admin/users` | admin |
| `GET`  | `/api/admin/users/:id` | admin |
| `POST` | `/api/admin/users/:id/decision` | admin |
| `GET`  | `/api/admin/export/xml` | admin |
| `GET`  | `/api/admin/export/json` | admin |

## Biased Matrix Factorization Recommender

Implemented from scratch in TypeScript (no ML libraries). Code: `backend/src/services/recommender/`.

- **Prediction:** `r̂(u,i) = μ + b_u + b_i + p_u · q_i`
- **Loss:** regularized squared error
- **Optimizer:** stochastic gradient descent with shuffling per epoch
- **Inputs:** confirmed bookings (rating 5.0) and event detail views (rating 2.0), deduplicated per (user, event)
- **Cold-start:** users with no history → most popular published events; users with only views → BMF is queried but tail-filled with popular events
- **Reproducibility:** deterministic PRNG (mulberry32)

To retrain on demand:
```bash
cd backend && npm run train
```
Or from the admin UI: **Admin → Export → Επανεκπαίδευση**.

A sanity test using a synthetic dataset is included:
```bash
cd backend && npx tsx src/services/recommender/__test.ts
```
This verifies that training reduces RMSE and that top-N recommendations align with the latent tastes of synthetic users.

### Evaluation on the provided dataset

The assignment ships a dataset (`rel_event_csvs/`) for the recommender. The
`eval:recommender` script trains the **same** from-scratch BMF on the real
`event_interest.csv` interactions and reports held-out quality:

```bash
cd backend && npm run eval:recommender
# custom path / k-core thresholds:
# npm run eval:recommender -- ../rel_event_csvs/event_interest.csv 5 5
```

- **Pseudo-ratings** mirror the live app: `interested → 5.0`, `shown/invited → 2.0`, `not_interested → 1.0`.
- **k-core filtering** (default ≥5 interactions per user and per event) prunes the extremely sparse raw matrix (~0.09% dense) to an evaluable core (~6% dense). Override the thresholds via CLI args.
- **Split:** deterministic 80/20; test RMSE is measured only on (user, event) pairs the model has actually seen.
- **Metrics:** per-epoch training RMSE, held-out test RMSE, and ranking quality (HitRate@K / Precision@K / Recall@K).

Representative run (k-core 5/5): 367 users × 92 events, train RMSE 1.36 → 0.95,
test RMSE ≈ 1.22, **HitRate@10 ≈ 0.35**, Recall@10 ≈ 0.33 — i.e. for ~1 in 3
users a genuinely interesting event lands in the top-10.

## Project Structure

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          PostgreSQL schema
│   │   └── seed.ts                Seeds admin + demo data
│   ├── src/
│   │   ├── index.ts               Express bootstrap (HTTP/HTTPS)
│   │   ├── routes/
│   │   │   ├── auth.ts            register / login / me
│   │   │   ├── admin.ts           user mgmt, XML/JSON export
│   │   │   ├── events.ts          CRUD + publish/cancel/photos
│   │   │   ├── bookings.ts        booking flow + my bookings
│   │   │   ├── messages.ts        inbox/sent/unread/send/delete
│   │   │   └── recommendations.ts BMF inference + retrain
│   │   ├── services/
│   │   │   ├── export.ts          XML (DTD-compliant) + JSON builders
│   │   │   └── recommender/
│   │   │       ├── model.ts       BMF math (SGD)
│   │   │       ├── index.ts       Data loading + cold-start handling
│   │   │       ├── train.ts       CLI retrain script
│   │   │       └── __test.ts      Synthetic sanity test
│   │   ├── middleware/
│   │   │   ├── auth.ts            JWT + role guards
│   │   │   └── error.ts           Central error handler
│   │   └── lib/                   prisma client, env, jwt helpers
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                Routes + protected pages
│   │   ├── components/            Navbar, EventCard, EventMap (Leaflet)
│   │   ├── pages/                 17 pages (welcome, login, register, home,
│   │   │                          browse, detail, my-events, editor, bookings,
│   │   │                          my-bookings, messages, admin/*)
│   │   ├── hooks/useAuth.tsx      Auth context + JWT lifecycle
│   │   ├── lib/api.ts             Fetch wrapper with auth header
│   │   └── lib/types.ts           Shared TypeScript types
│   └── package.json
└── README.md
```

## Extra Notes

- **DTD-compliant XML export:** `backend/src/services/export.ts` emits the structure defined in §7 of the assignment, including the `<GeoLocation Latitude= Longitude=/>` attribute element, `Category+`, optional `Media`, etc.
- **Capacity validation:** enforced in both the create and update event paths (`backend/src/routes/events.ts:38`), and a non-blocking client-side hint shows the running total in the editor.
- **Atomic booking:** the booking transaction (`backend/src/routes/bookings.ts:14`) locks the event row, checks both per-ticket-type availability and total capacity, and decrements `available` in the same transaction.
- **Cancellation messaging:** when an organizer cancels a PUBLISHED event, the server bulk-creates inbox messages for every confirmed attendee (`backend/src/routes/events.ts:262`).
- **Delete vs. cancel rules:** delete is rejected after the first booking (or for PUBLISHED events that already have bookings); cancel sets `status=CANCELLED` and preserves history. See `backend/src/routes/events.ts:289`.
- **Search:** category, title, description (case-insensitive `contains`), date range, price range (per ticket type), city — see `backend/src/routes/events.ts:54`.
- **Map:** Leaflet + OpenStreetMap tiles on the event detail page (`frontend/src/components/EventMap.tsx`).
