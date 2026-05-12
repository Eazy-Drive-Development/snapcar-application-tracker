# Snapcar Tracker

Snapcar Tracker is a responsive performance and payment tracking web application built for Snapcar, a Pune-based self-drive car rental service operated by Hands Rental Pvt Ltd.

Snapcar connects customers directly with local vendors, offers transparent pricing, flexible rental durations, and supports hatchbacks, sedans, SUVs and dual-fuel vehicles. This dashboard is designed to help the Snapcar operations team monitor day-wise bookings, daily earnings and pending vendor payouts.

The project is meant for fast deployment as Docker containers and easy adaptation by new developers.

## What is included

- Backend: Node.js + Express + TypeScript + MySQL
- Frontend: React + Vite + TypeScript
- Docker support for backend and frontend
- Clean, maintainable code structure with environment-based configuration
- Analytics endpoints for daily bookings, earnings, pending payments, and summary metrics

## Setup

1. Copy `.env.example` to `.env` in both `backend` and `frontend`.
2. Add your MySQL credentials to `backend/.env`.
3. Install dependencies in each folder:
   - `cd backend && npm install`
   - `cd frontend && npm install`
4. Start services locally:
   - `cd backend && npm run dev`
   - `cd frontend && npm run dev`

## Frontend environment

The frontend expects `VITE_API_BASE_URL` to be set in `frontend/.env`.
For a local development workflow, the default value is `/api`.

## Docker

A `docker-compose.yml` file is included at the repository root.

To run both services with Docker:

```bash
docker compose up --build
```

The frontend is configured to call the backend API at `http://localhost:4000/api`.

## Database

Use `backend/database/schema.sql` to create the tables and seed example data. If your MySQL server is hosted remotely, update the `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` values in `backend/.env`.

## Notes

- The API connects to a MySQL database, so provide a hosted MySQL server via environment variables.
- The frontend is configured to call the backend API using `VITE_API_BASE_URL`.
