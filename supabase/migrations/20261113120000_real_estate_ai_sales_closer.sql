-- AI WhatsApp Sales Closer — Real Estate schema
-- Tables, indexes, triggers, RLS, grants and AI-agent RPC tool functions.
-- Apply with: supabase db push / migration, or via Supabase MCP apply_migration.

-- ============================================================
-- updated_at helper
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Tables
-- ============================================================

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  email text unique,
  specialization text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  developer text,
  project_type text not null default 'residential'
    check (project_type in ('residential','commercial','mixed')),
  status text not null default 'under_construction'
    check (status in ('pre_launch','launch','under_construction','ready','completed')),
  city text not null,
  locality text,
  address text,
  possession_date date,
  amenities text[] not null default '{}',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  property_type text not null
    check (property_type in ('apartment','villa','plot','penthouse','commercial_office','retail_shop','warehouse','independent_house')),
  listing_type text not null default 'sale' check (listing_type in ('sale','rent')),
  price numeric(14,2) not null check (price >= 0),
  price_per_sqft numeric(12,2),
  bedrooms integer check (bedrooms >= 0),
  bathrooms integer check (bathrooms >= 0),
  balconies integer check (balconies >= 0),
  area_sqft numeric(10,2) check (area_sqft >= 0),
  floor integer,
  total_floors integer,
  furnishing text check (furnishing in ('unfurnished','semi_furnished','furnished')),
  facing text,
  parking integer check (parking >= 0),
  availability text not null default 'available'
    check (availability in ('available','reserved','sold','rented')),
  status text not null default 'active' check (status in ('active','inactive')),
  city text not null,
  locality text,
  address text,
  description text,
  features text[] not null default '{}',
  images text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_search_idx
  on public.properties (status, availability, listing_type, property_type, city);
create index if not exists properties_price_idx on public.properties (price);
create index if not exists properties_locality_idx on public.properties (locality);
create index if not exists properties_project_idx on public.properties (project_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  email text,
  source text not null default 'whatsapp'
    check (source in ('whatsapp','website','99acres','magicbricks','housing','facebook','instagram','referral','walk_in','google_ads','other')),
  status text not null default 'new'
    check (status in ('new','contacted','qualified','interested','site_visit_scheduled','negotiation','won','lost','not_interested')),
  listing_type text default 'sale' check (listing_type in ('sale','rent')),
  property_type text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  preferred_city text,
  preferred_locality text,
  bedrooms integer check (bedrooms >= 0),
  purpose text check (purpose in ('end_use','investment')),
  timeline text check (timeline in ('immediate','1-3_months','3-6_months','6-12_months','exploring')),
  qualification_score integer not null default 0 check (qualification_score between 0 and 100),
  assigned_agent_id uuid references public.agents(id) on delete set null,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_agent_idx on public.leads (assigned_agent_id);
create index if not exists leads_follow_up_idx on public.leads (next_follow_up_at)
  where next_follow_up_at is not null;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp','website','phone','email','instagram','other')),
  status text not null default 'open' check (status in ('open','closed','handed_off')),
  started_at timestamptz not null default now(),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists conversations_lead_idx on public.conversations (lead_id);
create index if not exists conversations_open_idx on public.conversations (lead_id)
  where status = 'open';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  sender text not null default 'lead' check (sender in ('lead','ai','agent')),
  body text not null,
  message_type text not null default 'text'
    check (message_type in ('text','image','audio','video','document','location','template','other')),
  whatsapp_message_id text,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_lead_idx on public.messages (lead_id, created_at);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  appointment_type text not null default 'site_visit'
    check (appointment_type in ('site_visit','call','meeting','virtual_tour')),
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled','no_show','rescheduled')),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_lead_idx on public.appointments (lead_id);
create index if not exists appointments_agent_idx on public.appointments (agent_id);
create index if not exists appointments_property_idx on public.appointments (property_id);
create index if not exists appointments_scheduled_idx on public.appointments (scheduled_at)
  where status = 'scheduled';

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  due_at timestamptz not null,
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp','phone','email','sms')),
  note text,
  status text not null default 'pending'
    check (status in ('pending','done','skipped','cancelled')),
  created_by text not null default 'ai' check (created_by in ('ai','agent','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists follow_ups_due_idx on public.follow_ups (due_at)
  where status = 'pending';
create index if not exists follow_ups_lead_idx on public.follow_ups (lead_id);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null
    check (activity_type in ('created','message_sent','message_received','qualified','interested_marked','property_shared','appointment_booked','follow_up_scheduled','note_added','status_changed','handoff','other')),
  description text,
  metadata jsonb not null default '{}',
  created_by text not null default 'ai' check (created_by in ('ai','agent','system')),
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at);

-- Extra table: captured details of leads who show buy/rent interest
create table if not exists public.interested_leads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  preferred_city text,
  preferred_locality text,
  property_type text,
  bedrooms integer,
  purpose text check (purpose in ('end_use','investment')),
  property_id uuid references public.properties(id) on delete set null,
  message text,
  source text not null default 'whatsapp',
  status text not null default 'new'
    check (status in ('new','contacted','converted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interested_leads_phone_idx on public.interested_leads (phone);
create index if not exists interested_leads_lead_idx on public.interested_leads (lead_id);
create index if not exists interested_leads_status_idx on public.interested_leads (status);
create index if not exists interested_leads_property_idx on public.interested_leads (property_id);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null
    check (category in ('greeting','qualification','follow_up','objection','closing','appointment','handoff','other')),
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- updated_at triggers
drop trigger if exists set_updated_at on public.agents;
create trigger set_updated_at before update on public.agents
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.projects;
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.properties;
create trigger set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.appointments;
create trigger set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.follow_ups;
create trigger set_updated_at before update on public.follow_ups
  for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.interested_leads;
create trigger set_updated_at before update on public.interested_leads
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS: enabled everywhere, no anon/authenticated access.
-- Agents/n8n connect with the service_role key (bypasses RLS).
-- ============================================================
alter table public.agents enable row level security;
alter table public.projects enable row level security;
alter table public.properties enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.appointments enable row level security;
alter table public.follow_ups enable row level security;
alter table public.lead_activities enable row level security;
alter table public.interested_leads enable row level security;
alter table public.message_templates enable row level security;

revoke all on public.agents, public.projects, public.properties, public.leads,
  public.conversations, public.messages, public.appointments, public.follow_ups,
  public.lead_activities, public.interested_leads, public.message_templates
  from anon, authenticated;

-- ============================================================
-- Phone helper (digits only)
-- ============================================================
create or replace function public.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
$$;

-- ============================================================
-- AI-agent tool functions (RPC). SECURITY INVOKER; service_role only.
-- ============================================================

-- 1) Look up a lead by WhatsApp phone number
create or replace function public.get_lead_by_phone(p_phone text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(to_jsonb(l), 'null'::jsonb)
  from public.leads l
  where l.phone = public.normalize_phone(p_phone);
$$;

-- 2) Create-or-update a lead (call on every inbound message)
create or replace function public.upsert_lead(
  p_phone text,
  p_name text default null,
  p_source text default 'whatsapp',
  p_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_lead public.leads;
  v_is_new boolean := false;
begin
  if v_phone = '' then
    return jsonb_build_object('success', false, 'error', 'phone is required');
  end if;

  insert into public.leads (phone, name, source, email, last_contacted_at)
  values (v_phone, p_name, coalesce(p_source, 'whatsapp'), p_email, now())
  on conflict (phone) do update
    set name = coalesce(excluded.name, public.leads.name),
        email = coalesce(excluded.email, public.leads.email),
        last_contacted_at = now()
  returning * into v_lead;

  v_is_new := (v_lead.created_at = v_lead.updated_at);

  insert into public.lead_activities (lead_id, activity_type, description, created_by)
  values (v_lead.id, 'created', 'Lead upserted from ' || coalesce(p_source, 'whatsapp'), 'ai');

  return jsonb_build_object('success', true, 'lead', to_jsonb(v_lead), 'is_new', v_is_new);
end;
$$;

-- 3) Update qualification details / stage as the AI learns them
create or replace function public.update_lead_qualification(
  p_phone text,
  p_status text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_preferred_city text default null,
  p_preferred_locality text default null,
  p_property_type text default null,
  p_bedrooms integer default null,
  p_purpose text default null,
  p_timeline text default null,
  p_qualification_score integer default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_lead public.leads;
begin
  update public.leads
  set status = coalesce(p_status, status),
      budget_min = coalesce(p_budget_min, budget_min),
      budget_max = coalesce(p_budget_max, budget_max),
      preferred_city = coalesce(p_preferred_city, preferred_city),
      preferred_locality = coalesce(p_preferred_locality, preferred_locality),
      property_type = coalesce(p_property_type, property_type),
      bedrooms = coalesce(p_bedrooms, bedrooms),
      purpose = coalesce(p_purpose, purpose),
      timeline = coalesce(p_timeline, timeline),
      qualification_score = coalesce(p_qualification_score, qualification_score),
      notes = coalesce(p_notes, notes)
  where phone = v_phone
  returning * into v_lead;

  if not found then
    return jsonb_build_object('success', false, 'error', 'lead not found for phone ' || v_phone);
  end if;

  insert into public.lead_activities (lead_id, activity_type, description, metadata, created_by)
  values (v_lead.id,
          case when p_status is not null then 'status_changed' else 'qualified' end,
          'AI updated qualification',
          jsonb_strip_nulls(jsonb_build_object('status', p_status, 'budget_min', p_budget_min,
            'budget_max', p_budget_max, 'property_type', p_property_type, 'bedrooms', p_bedrooms,
            'timeline', p_timeline, 'qualification_score', p_qualification_score)),
          'ai');

  return jsonb_build_object('success', true, 'lead', to_jsonb(v_lead));
end;
$$;

-- 4) Search available properties matching the lead's criteria
create or replace function public.search_properties(
  p_property_type text default null,
  p_listing_type text default 'sale',
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_bedrooms integer default null,
  p_city text default null,
  p_locality text default null,
  p_limit integer default 5
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(p) order by p.price), '[]'::jsonb)
  from (
    select pr.id, pr.title, pr.property_type, pr.listing_type, pr.price, pr.price_per_sqft,
           pr.bedrooms, pr.bathrooms, pr.area_sqft, pr.furnishing, pr.city, pr.locality,
           pr.project_id, pr.description, pr.features, pr.availability
    from public.properties pr
    where pr.status = 'active'
      and pr.availability = 'available'
      and (p_property_type is null or pr.property_type = p_property_type)
      and (p_listing_type is null or pr.listing_type = p_listing_type)
      and (p_min_price is null or pr.price >= p_min_price)
      and (p_max_price is null or pr.price <= p_max_price)
      and (p_bedrooms is null or pr.bedrooms = p_bedrooms)
      and (p_city is null or pr.city ilike '%' || p_city || '%')
      and (p_locality is null or pr.locality ilike '%' || p_locality || '%')
    order by pr.price
    limit greatest(1, least(coalesce(p_limit, 5), 20))
  ) p;
$$;

-- 5) Full details for one property
create or replace function public.get_property_details(p_property_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(to_jsonb(p), 'null'::jsonb)
  from public.properties p
  where p.id = p_property_id;
$$;

-- 6) Capture an interested lead (the extra table) + mark lead as interested
create or replace function public.save_interested_lead(
  p_phone text,
  p_name text,
  p_email text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_preferred_city text default null,
  p_preferred_locality text default null,
  p_property_type text default null,
  p_bedrooms integer default null,
  p_purpose text default null,
  p_property_id uuid default null,
  p_message text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_lead public.leads;
  v_row public.interested_leads;
begin
  if v_phone = '' or p_name is null then
    return jsonb_build_object('success', false, 'error', 'phone and name are required');
  end if;

  select * into v_lead from public.leads where phone = v_phone;

  insert into public.interested_leads (
    lead_id, name, phone, email, budget_min, budget_max, preferred_city,
    preferred_locality, property_type, bedrooms, purpose, property_id, message
  ) values (
    v_lead.id, p_name, v_phone, p_email, p_budget_min, p_budget_max, p_preferred_city,
    p_preferred_locality, p_property_type, p_bedrooms, p_purpose, p_property_id, p_message
  )
  returning * into v_row;

  if v_lead.id is not null then
    update public.leads
    set status = 'interested', last_contacted_at = now()
    where id = v_lead.id;

    insert into public.lead_activities (lead_id, activity_type, description, metadata, created_by)
    values (v_lead.id, 'interested_marked',
            'Lead expressed interest and shared contact details',
            jsonb_build_object('interested_lead_id', v_row.id, 'property_id', p_property_id),
            'ai');
  end if;

  return jsonb_build_object('success', true, 'interested_lead', to_jsonb(v_row));
end;
$$;

-- 7) Book a site visit / appointment
create or replace function public.book_appointment(
  p_phone text,
  p_scheduled_at timestamptz,
  p_property_id uuid default null,
  p_appointment_type text default 'site_visit',
  p_agent_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_lead public.leads;
  v_appt public.appointments;
begin
  select * into v_lead from public.leads where phone = v_phone;
  if not found then
    return jsonb_build_object('success', false, 'error', 'lead not found for phone ' || v_phone);
  end if;

  insert into public.appointments (lead_id, property_id, agent_id, appointment_type, scheduled_at, notes)
  values (v_lead.id, p_property_id, coalesce(p_agent_id, v_lead.assigned_agent_id),
          coalesce(p_appointment_type, 'site_visit'), p_scheduled_at, p_notes)
  returning * into v_appt;

  update public.leads
  set status = 'site_visit_scheduled', last_contacted_at = now()
  where id = v_lead.id;

  insert into public.lead_activities (lead_id, activity_type, description, metadata, created_by)
  values (v_lead.id, 'appointment_booked',
          'Appointment booked for ' || p_scheduled_at::text,
          jsonb_build_object('appointment_id', v_appt.id, 'property_id', p_property_id, 'type', p_appointment_type),
          'ai');

  return jsonb_build_object('success', true, 'appointment', to_jsonb(v_appt));
end;
$$;

-- 8) Schedule a follow-up
create or replace function public.schedule_follow_up(
  p_phone text,
  p_due_at timestamptz,
  p_note text default null,
  p_channel text default 'whatsapp'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_lead public.leads;
  v_fu public.follow_ups;
begin
  select * into v_lead from public.leads where phone = v_phone;
  if not found then
    return jsonb_build_object('success', false, 'error', 'lead not found for phone ' || v_phone);
  end if;

  insert into public.follow_ups (lead_id, due_at, channel, note)
  values (v_lead.id, p_due_at, coalesce(p_channel, 'whatsapp'), p_note)
  returning * into v_fu;

  update public.leads
  set next_follow_up_at = least(coalesce(next_follow_up_at, p_due_at), p_due_at)
  where id = v_lead.id;

  insert into public.lead_activities (lead_id, activity_type, description, metadata, created_by)
  values (v_lead.id, 'follow_up_scheduled',
          'Follow-up scheduled for ' || p_due_at::text,
          jsonb_build_object('follow_up_id', v_fu.id, 'channel', p_channel),
          'ai');

  return jsonb_build_object('success', true, 'follow_up', to_jsonb(v_fu));
end;
$$;

-- 9) Due follow-ups (for a scheduled n8n workflow)
create or replace function public.get_due_follow_ups(p_limit integer default 20)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'follow_up_id', f.id,
    'due_at', f.due_at,
    'channel', f.channel,
    'note', f.note,
    'lead_id', l.id,
    'phone', l.phone,
    'name', l.name,
    'status', l.status
  ) order by f.due_at), '[]'::jsonb)
  from (
    select * from public.follow_ups
    where status = 'pending' and due_at <= now()
    order by due_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) f
  join public.leads l on l.id = f.lead_id;
$$;

-- 10) Log an activity / note on a lead
create or replace function public.log_lead_activity(
  p_phone text,
  p_activity_type text,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_lead_id uuid;
  v_activity_id uuid;
begin
  select id into v_lead_id from public.leads where phone = v_phone;
  if v_lead_id is null then
    return jsonb_build_object('success', false, 'error', 'lead not found for phone ' || v_phone);
  end if;

  insert into public.lead_activities (lead_id, activity_type, description, metadata)
  values (v_lead_id, coalesce(p_activity_type, 'other'), p_description, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_activity_id;

  return jsonb_build_object('success', true, 'activity_id', v_activity_id);
end;
$$;

-- 11) Full context for a lead: profile + recent messages + upcoming appointment + pending follow-ups
create or replace function public.get_lead_context(p_phone text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with l as (
    select * from public.leads where phone = public.normalize_phone(p_phone)
  )
  select case when not exists (select 1 from l) then 'null'::jsonb
    else jsonb_build_object(
      'lead', (select to_jsonb(l) from l),
      'recent_messages', (
        select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
        from (
          select direction, sender, body, message_type, created_at
          from public.messages
          where lead_id = (select id from l)
          order by created_at desc
          limit 15
        ) m
      ),
      'next_appointment', (
        select to_jsonb(a)
        from public.appointments a
        where a.lead_id = (select id from l) and a.status = 'scheduled' and a.scheduled_at >= now()
        order by a.scheduled_at
        limit 1
      ),
      'pending_follow_ups', (
        select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
        from public.follow_ups f
        where f.lead_id = (select id from l) and f.status = 'pending'
      )
    ) end;
$$;

-- 12) Persist a chat message and maintain the open conversation
create or replace function public.log_message(
  p_phone text,
  p_direction text,
  p_body text,
  p_sender text default null,
  p_message_type text default 'text',
  p_whatsapp_message_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  v_lead public.leads;
  v_conv public.conversations;
  v_msg public.messages;
begin
  select * into v_lead from public.leads where phone = v_phone;
  if not found then
    return jsonb_build_object('success', false, 'error', 'lead not found for phone ' || v_phone);
  end if;

  select * into v_conv
  from public.conversations
  where lead_id = v_lead.id and status = 'open'
  order by started_at desc
  limit 1;

  if not found then
    insert into public.conversations (lead_id, channel)
    values (v_lead.id, 'whatsapp')
    returning * into v_conv;
  end if;

  insert into public.messages (conversation_id, lead_id, direction, sender, body, message_type, whatsapp_message_id)
  values (
    v_conv.id, v_lead.id, p_direction,
    coalesce(p_sender, case when p_direction = 'inbound' then 'lead' else 'ai' end),
    p_body, coalesce(p_message_type, 'text'), p_whatsapp_message_id
  )
  returning * into v_msg;

  update public.conversations set last_message_at = now() where id = v_conv.id;
  update public.leads set last_contacted_at = now() where id = v_lead.id;

  return jsonb_build_object('success', true, 'conversation_id', v_conv.id, 'message', to_jsonb(v_msg));
end;
$$;

-- Service role only: these tools drive the AI agent, never the public client
revoke execute on function public.normalize_phone(text) from public, anon, authenticated;
revoke execute on function public.get_lead_by_phone(text) from public, anon, authenticated;
revoke execute on function public.upsert_lead(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.update_lead_qualification(text, text, numeric, numeric, text, text, text, integer, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.search_properties(text, text, numeric, numeric, integer, text, text, integer) from public, anon, authenticated;
revoke execute on function public.get_property_details(uuid) from public, anon, authenticated;
revoke execute on function public.save_interested_lead(text, text, text, numeric, numeric, text, text, text, integer, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.book_appointment(text, timestamptz, uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.schedule_follow_up(text, timestamptz, text, text) from public, anon, authenticated;
revoke execute on function public.get_due_follow_ups(integer) from public, anon, authenticated;
revoke execute on function public.log_lead_activity(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.get_lead_context(text) from public, anon, authenticated;
revoke execute on function public.log_message(text, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.normalize_phone(text) to service_role;
grant execute on function public.get_lead_by_phone(text) to service_role;
grant execute on function public.upsert_lead(text, text, text, text) to service_role;
grant execute on function public.update_lead_qualification(text, text, numeric, numeric, text, text, text, integer, text, text, integer, text) to service_role;
grant execute on function public.search_properties(text, text, numeric, numeric, integer, text, text, integer) to service_role;
grant execute on function public.get_property_details(uuid) to service_role;
grant execute on function public.save_interested_lead(text, text, text, numeric, numeric, text, text, text, integer, text, uuid, text) to service_role;
grant execute on function public.book_appointment(text, timestamptz, uuid, text, uuid, text) to service_role;
grant execute on function public.schedule_follow_up(text, timestamptz, text, text) to service_role;
grant execute on function public.get_due_follow_ups(integer) to service_role;
grant execute on function public.log_lead_activity(text, text, text, jsonb) to service_role;
grant execute on function public.get_lead_context(text) to service_role;
grant execute on function public.log_message(text, text, text, text, text, text) to service_role;

grant all on all tables in schema public to service_role;
