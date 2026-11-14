import { ResourceListPage } from "../components/ResourceListPage";
import { useState } from "react";

import { Icon } from "../components/Icon";
import { PropertyFormModal } from "../components/PropertyFormModal";
import { ProjectFormModal } from "../components/ProjectFormModal";
import type { Column } from "../components/DataTable";
import type { FilterField } from "../components/FilterBar";
import { formatDate, formatMoney, shortId, text } from "../format";
import { navigate } from "../router";
import type {
  Agent,
  Appointment,
  Conversation,
  FollowUp,
  InterestedLead,
  Lead,
  LeadActivity,
  Message,
  MessageTemplate,
  Project,
  Property,
} from "../types";

const options = (values: string[]) =>
  values.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  }));

const leadStatuses = options([
  "new",
  "contacted",
  "qualified",
  "interested",
  "site_visit_scheduled",
  "negotiation",
  "won",
  "lost",
  "not_interested",
]);

const leadSources = options([
  "whatsapp",
  "website",
  "99acres",
  "magicbricks",
  "housing",
  "facebook",
  "instagram",
  "referral",
  "walk_in",
  "google_ads",
  "other",
]);

const propertyTypes = options([
  "apartment",
  "villa",
  "plot",
  "penthouse",
  "commercial_office",
  "retail_shop",
  "warehouse",
  "independent_house",
]);

const listingTypes = options(["sale", "rent"]);
const availabilityOptions = options(["available", "reserved", "sold", "rented"]);
const projectStatuses = options([
  "pre_launch",
  "launch",
  "under_construction",
  "ready",
  "completed",
]);
const projectTypes = options(["residential", "commercial", "mixed"]);
const conversationStatuses = options(["open", "closed", "handed_off"]);
const channels = options(["whatsapp", "website", "phone", "email", "instagram", "other"]);
const directions = options(["inbound", "outbound"]);
const senders = options(["lead", "ai", "agent"]);
const appointmentTypes = options(["site_visit", "call", "meeting", "virtual_tour"]);
const appointmentStatuses = options([
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
]);
const followUpStatuses = options(["pending", "done", "skipped", "cancelled"]);
const followUpChannels = options(["whatsapp", "phone", "email", "sms"]);
const activityTypes = options([
  "created",
  "message_sent",
  "message_received",
  "qualified",
  "interested_marked",
  "property_shared",
  "appointment_booked",
  "follow_up_scheduled",
  "note_added",
  "status_changed",
  "handoff",
  "other",
]);
const createdByOptions = options(["ai", "agent", "system"]);
const interestedStatuses = options(["new", "contacted", "converted", "rejected"]);
const templateCategories = options([
  "greeting",
  "qualification",
  "follow_up",
  "objection",
  "closing",
  "appointment",
  "handoff",
  "other",
]);
const booleanOptions = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const leadFields: FilterField[] = [
  { name: "search", label: "Search", placeholder: "name, phone, email" },
  { name: "status", label: "Status", type: "select", options: leadStatuses },
  { name: "source", label: "Source", type: "select", options: leadSources },
  { name: "city", label: "City", placeholder: "preferred city" },
  { name: "min_score", label: "Min score", type: "number" },
];

const leadColumns: Column<Lead>[] = [
  { key: "name", label: "Name", render: (row) => text(row.name) },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "qualification_score", label: "Score" },
  { key: "preferred_city", label: "City", render: (row) => text(row.preferred_city) },
  { key: "budget_max", label: "Budget", render: (row) => formatMoney(row.budget_max) },
  { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
];

export function LeadsPage() {
  return (
    <ResourceListPage<Lead>
      title="Leads"
      description="Every lead captured from WhatsApp and other sources."
      endpoint="/api/leads"
      fields={leadFields}
      columns={leadColumns}
      getKey={(row) => row.id}
      actions={(row) => (
        <button type="button" onClick={() => navigate(`/leads/${row.id}`)}>
          View
        </button>
      )}
    />
  );
}

const propertyFields: FilterField[] = [
  { name: "search", label: "Search", placeholder: "title, city, locality" },
  { name: "city", label: "City" },
  { name: "property_type", label: "Type", type: "select", options: propertyTypes },
  { name: "listing_type", label: "Listing", type: "select", options: listingTypes },
  { name: "availability", label: "Availability", type: "select", options: availabilityOptions },
  { name: "min_price", label: "Min price", type: "number" },
  { name: "max_price", label: "Max price", type: "number" },
  { name: "bedrooms", label: "Min bedrooms", type: "number" },
];

const propertyColumns: Column<Property>[] = [
  { key: "title", label: "Title" },
  { key: "property_type", label: "Type" },
  { key: "listing_type", label: "Listing" },
  { key: "price", label: "Price", render: (row) => formatMoney(row.price) },
  { key: "city", label: "City" },
  { key: "bedrooms", label: "Beds", render: (row) => text(row.bedrooms) },
  { key: "bathrooms", label: "Baths", render: (row) => text(row.bathrooms) },
  { key: "availability", label: "Availability" },
];

export function PropertiesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <ResourceListPage<Property>
        title="Properties"
        description="Listings available to match against leads."
        endpoint="/api/properties"
        fields={propertyFields}
        columns={propertyColumns}
        getKey={(row) => row.id}
        headerAction={
          <button
            type="button"
            className="button button--primary"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="plus" size={15} /> Add property
          </button>
        }
        refreshKey={refreshKey}
        actions={(row) => (
          <>
            <button type="button" onClick={() => setEditing(row)}>
              Edit
            </button>{" "}
            <button type="button" onClick={() => navigate(`/properties/${row.id}`)}>
              View
            </button>
          </>
        )}
      />
      {createOpen ? (
        <PropertyFormModal
          initial={null}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            setRefreshKey((value) => value + 1);
          }}
        />
      ) : null}
      {editing ? (
        <PropertyFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRefreshKey((value) => value + 1);
          }}
        />
      ) : null}
    </>
  );
}

const projectFields: FilterField[] = [
  { name: "search", label: "Search", placeholder: "name, developer, city" },
  { name: "city", label: "City" },
  { name: "status", label: "Status", type: "select", options: projectStatuses },
  { name: "project_type", label: "Type", type: "select", options: projectTypes },
];

const projectColumns: Column<Project>[] = [
  { key: "name", label: "Name" },
  { key: "developer", label: "Developer", render: (row) => text(row.developer) },
  { key: "project_type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "city", label: "City" },
  { key: "possession_date", label: "Possession", render: (row) => text(row.possession_date) },
];

export function ProjectsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <ResourceListPage<Project>
        title="Projects"
        description="Developments that group multiple properties."
        endpoint="/api/projects"
        fields={projectFields}
        columns={projectColumns}
        getKey={(row) => row.id}
        headerAction={
          <button
            type="button"
            className="button button--primary"
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="plus" size={15} /> Add project
          </button>
        }
        refreshKey={refreshKey}
        actions={(row) => (
          <>
            <button type="button" onClick={() => setEditing(row)}>
              Edit
            </button>{" "}
            <button type="button" onClick={() => navigate(`/projects/${row.id}`)}>
              View
            </button>
          </>
        )}
      />
      {createOpen ? (
        <ProjectFormModal
          initial={null}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            setRefreshKey((value) => value + 1);
          }}
        />
      ) : null}
      {editing ? (
        <ProjectFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRefreshKey((value) => value + 1);
          }}
        />
      ) : null}
    </>
  );
}

const agentFields: FilterField[] = [
  { name: "search", label: "Search", placeholder: "name, phone, email" },
  { name: "is_active", label: "Active", type: "select", options: booleanOptions },
];

const agentColumns: Column<Agent>[] = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone", render: (row) => text(row.phone) },
  { key: "email", label: "Email", render: (row) => text(row.email) },
  { key: "specialization", label: "Specialization", render: (row) => text(row.specialization) },
  { key: "is_active", label: "Active", render: (row) => text(row.is_active) },
];

export function AgentsPage() {
  return (
    <ResourceListPage<Agent>
      title="Agents"
      description="Sales agents who can receive assigned leads."
      endpoint="/api/agents"
      fields={agentFields}
      columns={agentColumns}
      getKey={(row) => row.id}
      actions={(row) => (
        <button type="button" onClick={() => navigate(`/agents/${row.id}`)}>
          View
        </button>
      )}
    />
  );
}

const conversationFields: FilterField[] = [
  { name: "lead_id", label: "Lead ID" },
  { name: "status", label: "Status", type: "select", options: conversationStatuses },
  { name: "channel", label: "Channel", type: "select", options: channels },
];

const conversationColumns: Column<Conversation>[] = [
  { key: "id", label: "ID", render: (row) => shortId(row.id) },
  { key: "lead_id", label: "Lead", render: (row) => shortId(row.lead_id) },
  { key: "channel", label: "Channel" },
  { key: "status", label: "Status" },
  { key: "started_at", label: "Started", render: (row) => formatDate(row.started_at) },
  {
    key: "last_message_at",
    label: "Last message",
    render: (row) => formatDate(row.last_message_at),
  },
];

export function ConversationsPage() {
  return (
    <ResourceListPage<Conversation>
      title="Conversations"
      description="WhatsApp and other channel threads."
      endpoint="/api/conversations"
      fields={conversationFields}
      columns={conversationColumns}
      getKey={(row) => row.id}
      actions={(row) => (
        <button type="button" onClick={() => navigate(`/conversations/${row.id}`)}>
          View
        </button>
      )}
    />
  );
}

const messageFields: FilterField[] = [
  { name: "lead_id", label: "Lead ID" },
  { name: "conversation_id", label: "Conversation ID" },
  { name: "direction", label: "Direction", type: "select", options: directions },
  { name: "sender", label: "Sender", type: "select", options: senders },
];

const messageColumns: Column<Message>[] = [
  { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
  { key: "direction", label: "Direction" },
  { key: "sender", label: "Sender" },
  { key: "body", label: "Body" },
  { key: "message_type", label: "Type" },
  { key: "conversation_id", label: "Conversation", render: (row) => shortId(row.conversation_id) },
];

export function MessagesPage() {
  return (
    <ResourceListPage<Message>
      title="Messages"
      description="Raw message log across all conversations."
      endpoint="/api/messages"
      fields={messageFields}
      columns={messageColumns}
      getKey={(row) => row.id}
    />
  );
}

const appointmentFields: FilterField[] = [
  { name: "lead_id", label: "Lead ID" },
  { name: "agent_id", label: "Agent ID" },
  { name: "status", label: "Status", type: "select", options: appointmentStatuses },
  { name: "appointment_type", label: "Type", type: "select", options: appointmentTypes },
  { name: "upcoming", label: "Upcoming only", type: "select", options: booleanOptions },
];

const appointmentColumns: Column<Appointment>[] = [
  { key: "scheduled_at", label: "Scheduled", render: (row) => formatDate(row.scheduled_at) },
  { key: "appointment_type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "duration_minutes", label: "Minutes" },
  { key: "location", label: "Location", render: (row) => text(row.location) },
  { key: "lead_id", label: "Lead", render: (row) => shortId(row.lead_id) },
];

export function AppointmentsPage() {
  return (
    <ResourceListPage<Appointment>
      title="Appointments"
      description="Site visits, calls and meetings."
      endpoint="/api/appointments"
      fields={appointmentFields}
      columns={appointmentColumns}
      getKey={(row) => row.id}
      actions={(row) => (
        <button type="button" onClick={() => navigate(`/leads/${row.lead_id}`)}>
          Lead
        </button>
      )}
    />
  );
}

const followUpFields: FilterField[] = [
  { name: "lead_id", label: "Lead ID" },
  { name: "status", label: "Status", type: "select", options: followUpStatuses },
  { name: "channel", label: "Channel", type: "select", options: followUpChannels },
  { name: "due_before", label: "Due before", type: "date" },
];

const followUpColumns: Column<FollowUp>[] = [
  { key: "due_at", label: "Due", render: (row) => formatDate(row.due_at) },
  { key: "channel", label: "Channel" },
  { key: "status", label: "Status" },
  { key: "note", label: "Note", render: (row) => text(row.note) },
  { key: "created_by", label: "Created by" },
  { key: "lead_id", label: "Lead", render: (row) => shortId(row.lead_id) },
];

export function FollowUpsPage() {
  return (
    <ResourceListPage<FollowUp>
      title="Follow-ups"
      description="Scheduled nudges that keep leads moving."
      endpoint="/api/follow-ups"
      fields={followUpFields}
      columns={followUpColumns}
      getKey={(row) => row.id}
      actions={(row) => (
        <button type="button" onClick={() => navigate(`/leads/${row.lead_id}`)}>
          Lead
        </button>
      )}
    />
  );
}

const activityFields: FilterField[] = [
  { name: "lead_id", label: "Lead ID" },
  { name: "activity_type", label: "Type", type: "select", options: activityTypes },
  { name: "created_by", label: "Created by", type: "select", options: createdByOptions },
];

const activityColumns: Column<LeadActivity>[] = [
  { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
  { key: "activity_type", label: "Type" },
  { key: "description", label: "Description", render: (row) => text(row.description) },
  { key: "created_by", label: "Created by" },
  { key: "lead_id", label: "Lead", render: (row) => shortId(row.lead_id) },
];

export function ActivitiesPage() {
  return (
    <ResourceListPage<LeadActivity>
      title="Activities"
      description="Audit trail of everything that happened to a lead."
      endpoint="/api/activities"
      fields={activityFields}
      columns={activityColumns}
      getKey={(row) => row.id}
      actions={(row) => (
        <button type="button" onClick={() => navigate(`/leads/${row.lead_id}`)}>
          Lead
        </button>
      )}
    />
  );
}

const interestedFields: FilterField[] = [
  { name: "search", label: "Search", placeholder: "name, phone, message" },
  { name: "status", label: "Status", type: "select", options: interestedStatuses },
  { name: "city", label: "City", placeholder: "preferred city" },
];

const interestedColumns: Column<InterestedLead>[] = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "preferred_city", label: "City", render: (row) => text(row.preferred_city) },
  { key: "budget_max", label: "Budget", render: (row) => formatMoney(row.budget_max) },
  { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
];

export function InterestedLeadsPage() {
  return (
    <ResourceListPage<InterestedLead>
      title="Interested leads"
      description="Enquiries that have not been promoted to a lead yet."
      endpoint="/api/interested-leads"
      fields={interestedFields}
      columns={interestedColumns}
      getKey={(row) => row.id}
      actions={(row) => (
        <>
          {row.lead_id ? (
            <button type="button" onClick={() => navigate(`/leads/${row.lead_id}`)}>
              Lead
            </button>
          ) : null}
          {row.property_id ? (
            <button
              type="button"
              onClick={() => navigate(`/properties/${row.property_id}`)}
            >
              Property
            </button>
          ) : null}
        </>
      )}
    />
  );
}

const templateFields: FilterField[] = [
  { name: "category", label: "Category", type: "select", options: templateCategories },
  { name: "is_active", label: "Active", type: "select", options: booleanOptions },
];

const templateColumns: Column<MessageTemplate>[] = [
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "content", label: "Content" },
  { key: "is_active", label: "Active", render: (row) => text(row.is_active) },
  { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
];

export function TemplatesPage() {
  return (
    <ResourceListPage<MessageTemplate>
      title="Message templates"
      description="Reusable copy for outreach and follow-ups."
      endpoint="/api/message-templates"
      fields={templateFields}
      columns={templateColumns}
      getKey={(row) => row.id}
    />
  );
}
