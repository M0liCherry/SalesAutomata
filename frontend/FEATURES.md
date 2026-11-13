# Frontend Features

The frontend is a single-company, real-estate sales workspace for the AI WhatsApp
Sales Closer. It turns the read-only Supabase data exposed by the Rust backend
into a daily workspace for sales agents and managers.

Automation execution and AI conversation handling remain in n8n. This document
covers the frontend experience only.

## Stack

- React 19 + TypeScript + Vite
- Supabase Auth (`@supabase/supabase-js`)
- Rust/Axum JSON API (read-only today)
- No external UI or chart library

## Running

```bash
cd frontend
cp .env.example .env
# Optional: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for the login gate
npm install
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend base URL (default `http://localhost:8080`) |
| `VITE_SUPABASE_URL` | Supabase project URL for Auth |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key for Auth |

If the Supabase Auth variables are missing, the app runs in **demo mode** with a
banner and no login gate so the workspace can still be reviewed.

## Authentication and access

- Email/password sign-in and account creation through Supabase Auth.
- Session gate: the workspace only renders for an authenticated session.
- Email-confirmation handling for new accounts.
- User menu with account identity and sign-out.
- Demo mode fallback when Auth is not configured.
- Dedicated settings page for workspace, WhatsApp, automation, team and billing
  configuration UI.

## App shell

- Responsive sidebar grouped into Workspace, Inventory, Team & content and Data.
- Sticky top bar with breadcrumb, search trigger, notifications and user menu.
- Command palette (`Ctrl/Cmd+K`) for page navigation and lead lookup.
- Notifications popover derived from pending follow-ups, upcoming
  appointments and open conversations.
- Settings link in the sidebar plus user menu.
- Demo-mode banner explaining missing Auth configuration.
- Mobile navigation drawer and collapsible layouts.

## Dashboard (`/`)

The sales command centre answers "what needs attention today?".

- KPI cards: total leads, qualified leads, appointments, won deals and open chats.
- Pipeline funnel across lead stages.
- Attention panel: overdue follow-ups, unassigned leads, open conversations and
  scheduled appointments.
- Today's agenda: pending follow-ups and upcoming appointments.
- Lead-source breakdown for recent enquiries.
- Recent leads table with direct links to lead records.

## Leads (`/leads`)

- **Pipeline view**: horizontal kanban grouped by lead status with drag-and-drop
  status changes, stage counts and potential budget totals.
- **List view**: dense table with lead, status, source, city, budget, score,
  owner and created date.
- Stat chips for total, new, hot (70+), unassigned and locally changed leads.
- Filters for search, status, source, assigned agent and minimum score.
- CSV export of the currently loaded result set.
- Owner names resolved from the agents API.
- Local status overrides are persisted in browser storage until the mutation API
  is connected.

## Lead 360 (`/leads/{id}`)

A single record page for qualification, conversations and next actions.

- Profile strip with contact identity, stage, score, source, owner, last contact
  and next follow-up.
- Clickable stage track for moving a lead through the sales pipeline.
- Tabs for Overview, Timeline, Conversations, Appointments and Follow-ups.
- Qualification grid: budget, city/locality, property type, bedrooms, purpose,
  timeline, listing type, score and timestamps.
- Property matching based on city, type, budget, bedrooms and listing type.
- Merged activity timeline from server activities and local UI actions.
- Quick actions: add note, log a call, schedule follow-up and open WhatsApp.
- Local notes, status changes and follow-ups are persisted in browser storage
  until write APIs are available.

## WhatsApp inbox (`/inbox`, `/inbox/{id}`)

The daily conversation workspace for WhatsApp threads.

- Conversation list with search, status filter and lead enrichment.
- Latest-message preview, relative timestamps and channel/status badges.
- Chat thread with day separators, inbound/outbound bubbles, sender labels and
  delivery context.
- Composer with Enter-to-send, Shift+Enter for newline, template picker and
  attachment placeholder.
- Template variables rendered for the active lead (`{{name}}`, `{{phone}}`,
  `{{city}}`, `{{budget}}`).
- AI control: show AI active/paused state, "Take over" and "Resume AI" actions.
- Contact panel with lead qualification, follow-up context and a link to the full
  lead record.
- Locally sent messages are persisted in browser storage and marked as local
  until the WhatsApp send API/n8n workflow is connected.
- `/conversations` and `/conversations/{id}` remain aliases for the inbox.

## Appointments (`/appointments`)

- Stat chips: scheduled, completed, cancelled and no-show.
- Search by lead name/phone plus status, type and upcoming filters.
- **Agenda view** grouped by day.
- **Week view** with previous/next controls and compact day cards.
- Appointment detail modal with lead, agent, type, time, duration, location,
  status and notes.
- Local actions to create, reschedule and mark completed/cancelled/no-show.
- Loading, error and empty states.

## Follow-ups (`/follow-ups`)

- Stat chips: overdue, due today, upcoming and done.
- Search by lead name/phone plus status, channel and due-date filters.
- Task buckets for Overdue, Today, Upcoming and Done.
- Task cards with lead, channel, note, due time, status and creator.
- Local actions: mark done, snooze one day, reschedule and add follow-up.
- Loading, error and empty states.

## Properties (`/properties`)

- Stat chips: total, available, for sale and for rent.
- Filters for search, city, property type, listing type, availability, price
  range and bedrooms.
- Grid and table views.
- Project names resolved from the projects API.
- Cards show title, project, type, listing, price, location, bedrooms,
  bathrooms, area, availability and top features.
- Actions: open detail, copy listing link and "Share on WhatsApp" placeholder.
- CSV export of the loaded result set.

## Projects (`/projects`)

- Stat chips for total and dynamic status counts.
- Filters for search, city, status and project type.
- Grid and table views.
- Cards show name, developer, type, status, location, possession date, amenities
  count and description snippet.
- Open project detail and export CSV.

## Analytics (`/analytics`)

- Date-range selector: last 7/30/90 days or all time.
- KPIs: leads, qualified leads, conversion rate, appointments, won value/count
  and average qualification score.
- Pipeline distribution with horizontal bars.
- Lead-source performance table with leads, qualified, won and conversion %.
- City performance for the top preferred cities.
- Agent performance with assigned leads, won leads, conversion and weighted
  score.
- Fourteen-day lead trend bars.
- Appointment status mix and follow-up SLA (overdue vs completed).
- CSV export of source performance and a full refresh action.

## Other workspace pages

- **Agents** (`/agents`, `/agents/{id}`): agent directory and assigned leads.
- **Templates** (`/message-templates`): reusable WhatsApp message templates.
- **Interested leads** (`/interested-leads`): raw enquiries not yet promoted.
- **Activity log** (`/activities`): audit trail of lead activity.
- **Message log** (`/messages`): raw message stream across conversations.
- **Settings** (`/settings`): workspace profile, WhatsApp connection status,
  n8n automation configuration, team access and billing/usage placeholders.

## Shared design system

- CSS variables for colour, surfaces, borders, shadows and radius.
- Shared primitives: buttons, inputs, badges, cards, tabs, modals, KPI cards,
  empty states, loading/error states and toast notifications.
- Custom inline SVG icon set.
- Responsive layouts for desktop, tablet and mobile, including the inbox and
  pipeline views.
- Consistent status tones for leads, appointments, follow-ups and conversations.
- Browser storage helpers for local-only mutations.
- History API routing with bookmarkable paths.

## Data flow and current limits

- Reads use the Rust backend's read-only JSON API.
- The browser never sees the Supabase `service_role` key.
- Supabase Auth is used only for the frontend login gate today.
- Status changes, notes, follow-ups, local messages, appointment changes and
  follow-up actions are persisted in `localStorage` until mutation APIs exist.
- No roles, tenant isolation or server-side authorization yet — this is a
  single-company deployment.
- No real-time subscriptions, file uploads, WhatsApp send, billing portal or
  n8n control API yet.

## Route map

| Route | Page |
| --- | --- |
| `/` | Dashboard |
| `/analytics` | Analytics and reporting |
| `/inbox` | WhatsApp inbox |
| `/inbox/{id}` | Selected conversation |
| `/leads` | Lead pipeline and list |
| `/leads/{id}` | Lead 360 |
| `/appointments` | Appointment workbench |
| `/follow-ups` | Follow-up task buckets |
| `/properties` | Property catalog |
| `/properties/{id}` | Property detail |
| `/projects` | Project catalog |
| `/projects/{id}` | Project detail |
| `/agents` | Agents |
| `/agents/{id}` | Agent detail |
| `/conversations` | Inbox alias |
| `/conversations/{id}` | Inbox conversation alias |
| `/messages` | Message log |
| `/activities` | Activity log |
| `/interested-leads` | Interested leads |
| `/message-templates` | Message templates |
| `/settings` | Workspace settings |

## Verification

```bash
cd frontend
npm run typecheck
npm run build
```

The app has also been smoke-tested in headless Chromium against a live backend
for the dashboard, leads, lead detail, inbox, analytics, appointments,
follow-ups, properties and projects routes.
