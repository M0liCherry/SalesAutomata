# SalesAutomata

## Problem Statement: AI WhatsApp Sales Closer

| Attribute | Details |
| --- | --- |
| **Domain** | Sales Automation / Conversational AI |
| **Problem** | Businesses receive leads through WhatsApp but fail to follow up consistently, qualify prospects or convert enquiries into sales. |
| **Target customers** | Real estate agencies, education companies, insurance agencies, automobile dealers, travel agencies and SMEs. |
| **Revenue streams** | Monthly subscription; per-agent pricing; per-conversation charges; premium CRM integrations; enterprise licences. |
| **MVP** | Connect WhatsApp, qualify incoming leads, automate follow-ups and schedule appointments. |
| **Market potential** | Very high – customers can measure its value through lead conversion and sales revenue. |

## Architecture

| Layer | Stack | Role |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Sales workspace: dashboard, lead pipeline, lead 360 view and WhatsApp inbox. Uses Supabase Auth. |
| Backend | Rust + Axum | Read-only JSON API over Supabase. |
| Database | Supabase Postgres | Leads, properties, projects, agents, conversations, messages, appointments, follow-ups, activities and templates. |

The backend talks to Supabase through its REST (PostgREST) API using the
project's `service_role` key. The key stays on the server and is never sent to
the browser.

## Requirements

- Rust toolchain (`cargo`)
- Node.js 20+ (`npm`)
- Supabase project URL and `service_role` key
- Supabase Auth project URL and `anon`/publishable key (frontend sign-in)

## Run

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env and set SUPABASE_SERVICE_ROLE_KEY
cargo run
```

Backend: http://localhost:8080

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173

The frontend defaults to `http://localhost:8080` for the API. Override it with
`VITE_API_URL` if the backend runs elsewhere.

Copy `frontend/.env.example` to `frontend/.env` and set the Supabase Auth values
to enable the login screen. If they are missing, the app starts in demo mode
without a login gate so the UI can still be reviewed.

## Backend API

All endpoints are `GET` and return JSON. List endpoints support `limit`,
`offset` and resource-specific filters.

| Endpoint | Description |
| --- | --- |
| `/health` | Backend and Supabase connectivity |
| `/api/dashboard/summary` | Counts for leads, inventory, agents, conversations, follow-ups and appointments |
| `/api/leads` | Leads with status, source, city, agent, score and search filters |
| `/api/leads/{id}` | Lead with agent, conversations, appointments, follow-ups and activities |
| `/api/properties` | Properties with city, type, listing, price, bedrooms, availability and search filters |
| `/api/properties/{id}` | Property with its project |
| `/api/projects` | Projects with city, status, type and search filters |
| `/api/projects/{id}` | Project with its properties |
| `/api/agents` | Agents with active and search filters |
| `/api/agents/{id}` | Agent with assigned leads |
| `/api/conversations` | Conversations with lead, status and channel filters |
| `/api/conversations/{id}` | Conversation with its lead and messages |
| `/api/messages` | Messages with lead, conversation, direction and sender filters |
| `/api/appointments` | Appointments with lead, agent, status, type and upcoming filters |
| `/api/follow-ups` | Follow-ups with lead, status, channel and due-date filters |
| `/api/activities` | Lead activities with lead, type and creator filters |
| `/api/interested-leads` | Interested leads with status, source, city and search filters |
| `/api/message-templates` | Templates with category and active filters |

## Frontend routes

| Route | Page |
| --- | --- |
| `/` | Sales command centre: KPIs, funnel, agenda and recent leads |
| `/analytics` | Pipeline, source, city, agent, trend and SLA reporting |
| `/inbox` | WhatsApp inbox and conversation view |
| `/inbox/{id}` | Selected conversation thread |
| `/leads` | Lead pipeline (kanban) and list view |
| `/leads/{id}` | Lead 360: qualification, timeline, chat, appointments and property matches |
| `/properties` | Property catalog with filters, grid/table and sharing actions |
| `/properties/{id}` | Property detail and project |
| `/projects` | Project catalog with filters, grid/table and export |
| `/projects/{id}` | Project detail and properties |
| `/agents` | Agents list |
| `/agents/{id}` | Agent detail and assigned leads |
| `/conversations` | Alias for the inbox |
| `/conversations/{id}` | Alias for a selected inbox conversation |
| `/messages` | Message log |
| `/appointments` | Appointment agenda and week calendar workbench |
| `/follow-ups` | Follow-up task buckets with due, snooze and reschedule actions |
| `/activities` | Activity log |
| `/interested-leads` | Interested leads list |
| `/message-templates` | Message templates list |
| `/settings` | Workspace, WhatsApp, automation, team and billing settings |

Routing uses the History API, so links look like `/leads`. Static hosts must
serve `index.html` for unknown paths.

See [frontend/FEATURES.md](frontend/FEATURES.md) for a detailed feature tour,
data-flow notes and current limitations.

## Project layout

```
backend/
  src/
    main.rs           server bootstrap
    config.rs         environment configuration
    supabase.rs       Supabase REST client
    query.rs          filter and pagination helpers
    models.rs         response models
    routes/           one module per resource
frontend/
  src/
    App.tsx           hash router
    api.ts            typed fetch wrapper
    types.ts          API response types
    components/       layout, table, filters, pagination, status
    pages/            dashboard, lists and detail pages
```

## Configuration

Backend environment variables (`backend/.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | project URL | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | required | Server-side key that bypasses RLS |
| `PORT` | `8080` | HTTP port |
| `CORS_ORIGIN` | `*` | Allowed origins, comma-separated |

Frontend environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8080` | Backend base URL |
| `VITE_SUPABASE_URL` | none | Supabase project URL for Auth |
| `VITE_SUPABASE_ANON_KEY` | none | Supabase anon/publishable key for Auth |

## Notes

- The database has RLS enabled with no policies, so anon/publishable keys
  cannot read these tables. The backend therefore requires the `service_role`
  key.
- The backend is still read-only. Status changes, notes, follow-ups and sent
  messages in the UI are stored locally in the browser until the write API is
  connected. Automation execution remains in n8n.
- `backend/.env`, `backend/target`, `frontend/node_modules` and `frontend/dist`
  are ignored by git.
