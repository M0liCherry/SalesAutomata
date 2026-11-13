import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Badge, PlainBadge, ScoreBadge, StatusBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon, type IconName } from "../components/Icon";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ErrorMessage, Loading } from "../components/Status";
import { Tabs } from "../components/Tabs";
import { formatDate, formatMoney, text } from "../format";
import { useApi } from "../hooks/useApi";
import {
  budgetRange,
  findStage,
  formatRelativeTime,
  isOverdue,
  LEAD_STAGES,
  titleCase,
} from "../lib/constants";
import {
  addLocalActivity,
  getLocalActivities,
  getLocalLeadStatus,
  setLocalLeadStatus,
  type LocalActivity,
} from "../lib/storage";
import { useToast } from "../lib/toast";
import { navigate } from "../router";
import type { LeadDetail, ListResponse, Property } from "../types";

type DetailTab = "overview" | "timeline" | "conversations" | "appointments" | "followups";
type ActionKind = "note" | "followup" | null;

const ACTIVITY_ICON: Record<string, IconName> = {
  created: "sparkles",
  message_sent: "message",
  message_received: "message",
  qualified: "check",
  interested_marked: "sparkles",
  property_shared: "property",
  appointment_booked: "calendar",
  follow_up_scheduled: "followup",
  note_added: "note",
  status_changed: "activity",
  handoff: "agents",
  call_logged: "phone",
};

function ActivityIcon({ type }: { type: string }) {
  return (
    <span className="timeline__icon">
      <Icon name={ACTIVITY_ICON[type] ?? "activity"} size={14} />
    </span>
  );
}

function PropertyMatches({ lead }: { lead: LeadDetail }) {
  const params: Record<string, string | number> = { limit: 4, availability: "available" };
  if (lead.preferred_city) {
    params.city = lead.preferred_city;
  }
  if (lead.property_type) {
    params.property_type = lead.property_type;
  }
  if (lead.budget_max) {
    params.max_price = lead.budget_max;
  }
  if (lead.bedrooms) {
    params.bedrooms = lead.bedrooms;
  }
  if (lead.listing_type) {
    params.listing_type = lead.listing_type;
  }

  const { data, loading, error } = useApi<ListResponse<Property>>("/api/properties", params);

  return (
    <section className="card">
      <header className="card__header">
        <div>
          <h2>Property matches</h2>
          <p>Based on city, type, budget and bedrooms.</p>
        </div>
        <button type="button" className="button button--ghost" onClick={() => navigate("/properties")}>
          View inventory
        </button>
      </header>
      {loading ? <Loading label="Matching properties..." /> : null}
      {error ? <p className="muted">Could not load matches.</p> : null}
      {!loading && !error && (data?.data.length ?? 0) === 0 ? (
        <p className="muted">No matching properties found.</p>
      ) : null}
      <div className="property-grid">
        {(data?.data ?? []).map((property) => (
          <button
            key={property.id}
            type="button"
            className="property-card"
            onClick={() => navigate(`/properties/${property.id}`)}
          >
            <div className="property-card__top">
              <Badge tone="info">{titleCase(property.property_type)}</Badge>
              <span>{formatMoney(property.price)}</span>
            </div>
            <strong>{property.title}</strong>
            <div className="property-card__meta">
              <span>
                <Icon name="mapPin" size={13} />
                {property.locality ?? property.city}
              </span>
              {property.bedrooms ? <span>{property.bedrooms} BHK</span> : null}
              {property.area_sqft ? <span>{property.area_sqft} sqft</span> : null}
            </div>
            <div className="property-card__footer">
              <span>{titleCase(property.availability)}</span>
              <Icon name="chevronRight" size={14} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function LeadDetailPage({ id }: { id: string }) {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi<LeadDetail>(`/api/leads/${id}`);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [localStatus, setLocalStatus] = useState<string | null>(() => getLocalLeadStatus(id));
  const [localActivities, setLocalActivities] = useState<LocalActivity[]>(() => getLocalActivities(id));
  const [action, setAction] = useState<ActionKind>(null);
  const [note, setNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");

  useEffect(() => {
    setLocalStatus(getLocalLeadStatus(id));
    setLocalActivities(getLocalActivities(id));
    setTab("overview");
  }, [id]);

  const activities = useMemo(() => {
    const server = data?.lead_activities ?? [];
    const merged = [
      ...localActivities.map((activity) => ({ ...activity })),
      ...server,
    ].sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
    return merged;
  }, [data, localActivities]);

  const refresh = () => {
    setLocalActivities(getLocalActivities(id));
    void reload();
  };

  if (loading) {
    return <Loading label="Loading lead..." />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={() => void reload()} />;
  }
  if (!data) {
    return <EmptyState icon="leads" title="Lead not found" />;
  }

  const status = localStatus ?? data.status;
  const stage = findStage(status);
  const owner = data.agents;
  const primaryConversation = data.conversations[0];

  const changeStatus = (next: string) => {
    if (next === status) {
      return;
    }
    setLocalLeadStatus(id, next);
    setLocalStatus(next);
    addLocalActivity(
      id,
      "status_changed",
      `Status changed from ${findStage(status).label} to ${findStage(next).label}`,
    );
    setLocalActivities(getLocalActivities(id));
    toast(`Status changed to ${findStage(next).label}. Saved locally.`, "warning");
  };

  const logActivity = (type: string, description: string, message: string) => {
    addLocalActivity(id, type, description);
    refresh();
    setAction(null);
    setNote("");
    setFollowUpAt("");
    setFollowUpNote("");
    toast(message, "success");
  };

  const submitNote = (event: FormEvent) => {
    event.preventDefault();
    if (!note.trim()) {
      return;
    }
    logActivity("note_added", note.trim(), "Note added.");
  };

  const submitFollowUp = (event: FormEvent) => {
    event.preventDefault();
    if (!followUpAt) {
      return;
    }
    logActivity(
      "follow_up_scheduled",
      `Follow-up scheduled for ${formatDate(followUpAt)}${followUpNote ? ` — ${followUpNote}` : ""}`,
      "Follow-up scheduled locally.",
    );
  };

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "timeline", label: "Timeline", count: activities.length },
    { value: "conversations", label: "Conversations", count: data.conversations.length },
    { value: "appointments", label: "Appointments", count: data.appointments.length },
    { value: "followups", label: "Follow-ups", count: data.follow_ups.length },
  ];

  return (
    <div className="stack">
      <button type="button" className="back-link" onClick={() => navigate("/leads")}>
        <Icon name="arrowLeft" size={15} /> Back to leads
      </button>

      <PageHeader
        title={data.name ?? data.phone}
        subtitle={`${data.phone}${data.email ? ` · ${data.email}` : ""}`}
        actions={
          <>
            <button
              type="button"
              className="button"
              onClick={() =>
                primaryConversation
                  ? navigate(`/inbox/${primaryConversation.id}`)
                  : navigate(`/inbox?lead=${data.id}`)
              }
            >
              <Icon name="inbox" size={15} /> Open chat
            </button>
            <button type="button" className="button" onClick={() => setAction("note")}>
              <Icon name="note" size={15} /> Add note
            </button>
            <button type="button" className="button button--primary" onClick={() => setAction("followup")}>
              <Icon name="calendar" size={15} /> Schedule follow-up
            </button>
          </>
        }
      />

      <div className="profile-strip card">
        <div className="profile-strip__identity">
          <span className="avatar avatar--lg">{data.name ? data.name[0]?.toUpperCase() : data.phone.slice(-2)}</span>
          <div>
            <div className="profile-strip__badges">
              <StatusBadge status={status} />
              <ScoreBadge score={data.qualification_score} />
              <Badge tone="neutral">{titleCase(data.source)}</Badge>
            </div>
            <p>
              {budgetRange(data.budget_min, data.budget_max)} ·{" "}
              {data.preferred_city ?? "City not set"} ·{" "}
              {data.property_type ? titleCase(data.property_type) : "Type not set"}
            </p>
          </div>
        </div>
        <div className="profile-strip__facts">
          <div>
            <span>Owner</span>
            <strong>{owner?.name ?? "Unassigned"}</strong>
          </div>
          <div>
            <span>Last contacted</span>
            <strong>{data.last_contacted_at ? formatRelativeTime(data.last_contacted_at) : "Never"}</strong>
          </div>
          <div>
            <span>Next follow-up</span>
            <strong className={isOverdue(data.next_follow_up_at) ? "text-danger" : ""}>
              {data.next_follow_up_at ? formatRelativeTime(data.next_follow_up_at) : "Not scheduled"}
            </strong>
          </div>
        </div>
        <label className="field field--inline profile-strip__status">
          <span>Move stage</span>
          <select value={status} onChange={(event) => changeStatus(event.target.value)}>
            {LEAD_STAGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="stage-track card">
        {LEAD_STAGES.filter((item) => item.value !== "not_interested").map((item, index) => {
          const currentIndex = LEAD_STAGES.filter((entry) => entry.value !== "not_interested").findIndex(
            (entry) => entry.value === status,
          );
          const done = index < currentIndex;
          const current = item.value === status;
          return (
            <button
              key={item.value}
              type="button"
              className={`stage-step ${current ? "stage-step--current" : ""} ${done ? "stage-step--done" : ""}`}
              onClick={() => changeStatus(item.value)}
            >
              <span className={`stage-step__dot stage-step__dot--${item.tone}`}>
                {done ? <Icon name="check" size={12} /> : null}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <Tabs
        items={tabs}
        value={tab}
        onChange={(value) => setTab(value as DetailTab)}
      />

      <div className="detail-layout">
        <div className="detail-main">
          {tab === "overview" ? (
            <>
              <section className="card">
                <header className="card__header">
                  <div>
                    <h2>Qualification</h2>
                    <p>What the lead is looking for and how ready they are.</p>
                  </div>
                  <Badge tone={stage.tone}>{stage.label}</Badge>
                </header>
                <dl className="info-grid">
                  <div>
                    <dt>Budget</dt>
                    <dd>{budgetRange(data.budget_min, data.budget_max)}</dd>
                  </div>
                  <div>
                    <dt>Preferred city</dt>
                    <dd>{text(data.preferred_city)}</dd>
                  </div>
                  <div>
                    <dt>Locality</dt>
                    <dd>{text(data.preferred_locality)}</dd>
                  </div>
                  <div>
                    <dt>Property type</dt>
                    <dd>{text(data.property_type)}</dd>
                  </div>
                  <div>
                    <dt>Bedrooms</dt>
                    <dd>{text(data.bedrooms)}</dd>
                  </div>
                  <div>
                    <dt>Purpose</dt>
                    <dd>{text(data.purpose)}</dd>
                  </div>
                  <div>
                    <dt>Timeline</dt>
                    <dd>{text(data.timeline)}</dd>
                  </div>
                  <div>
                    <dt>Listing type</dt>
                    <dd>{text(data.listing_type)}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{titleCase(data.source)}</dd>
                  </div>
                  <div>
                    <dt>Score</dt>
                    <dd>{data.qualification_score} / 100</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(data.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(data.updated_at)}</dd>
                  </div>
                </dl>
                {data.notes ? (
                  <div className="note-block">
                    <span>Lead notes</span>
                    <p>{data.notes}</p>
                  </div>
                ) : null}
              </section>

              <PropertyMatches lead={data} />

              <section className="card">
                <header className="card__header">
                  <div>
                    <h2>Recent activity</h2>
                    <p>Latest events on this lead.</p>
                  </div>
                  <button type="button" className="button button--ghost" onClick={() => setTab("timeline")}>
                    View all
                  </button>
                </header>
                {activities.length === 0 ? (
                  <p className="muted">No activity yet.</p>
                ) : (
                  <ul className="timeline timeline--compact">
                    {activities.slice(0, 5).map((activity) => (
                      <li key={activity.id}>
                        <ActivityIcon type={activity.activity_type} />
                        <div>
                          <strong>{titleCase(activity.activity_type)}</strong>
                          <p>{activity.description ?? "—"}</p>
                          <small>
                            {activity.created_by} · {formatRelativeTime(activity.created_at)}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}

          {tab === "timeline" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Full timeline</h2>
                  <p>Messages, notes, status changes and appointments in one place.</p>
                </div>
                <button type="button" className="button" onClick={() => setAction("note")}>
                  <Icon name="plus" size={14} /> Add note
                </button>
              </header>
              {activities.length === 0 ? (
                <EmptyState icon="activity" title="No activity yet" description="Log a call or add a note to start the timeline." />
              ) : (
                <ul className="timeline">
                  {activities.map((activity) => (
                    <li key={activity.id}>
                      <ActivityIcon type={activity.activity_type} />
                      <div>
                        <div className="timeline__head">
                          <strong>{titleCase(activity.activity_type)}</strong>
                          <small>{formatRelativeTime(activity.created_at)}</small>
                        </div>
                        <p>{activity.description ?? "—"}</p>
                        <small>{activity.created_by}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {tab === "conversations" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Conversations</h2>
                  <p>WhatsApp threads linked to this lead.</p>
                </div>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => navigate(primaryConversation ? `/inbox/${primaryConversation.id}` : "/inbox")}
                >
                  <Icon name="message" size={14} /> Open inbox
                </button>
              </header>
              {data.conversations.length === 0 ? (
                <EmptyState icon="inbox" title="No conversations yet" description="Start a WhatsApp conversation from the inbox." />
              ) : (
                <div className="record-list">
                  {data.conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className="record-row"
                      onClick={() => navigate(`/inbox/${conversation.id}`)}
                    >
                      <span className="record-row__icon">
                        <Icon name="whatsapp" size={16} />
                      </span>
                      <div>
                        <strong>{titleCase(conversation.channel)} conversation</strong>
                        <small>
                          Started {formatDate(conversation.started_at)} · Last message{" "}
                          {formatRelativeTime(conversation.last_message_at)}
                        </small>
                      </div>
                      <PlainBadge value={conversation.status} />
                      <Icon name="chevronRight" size={15} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {tab === "appointments" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Appointments</h2>
                  <p>Site visits, calls and meetings for this lead.</p>
                </div>
                <button type="button" className="button button--primary" onClick={() => setAction("followup")}>
                  <Icon name="plus" size={14} /> Schedule
                </button>
              </header>
              {data.appointments.length === 0 ? (
                <EmptyState icon="calendar" title="No appointments" description="Schedule the first site visit or call." />
              ) : (
                <div className="record-list">
                  {data.appointments.map((appointment) => (
                    <div key={appointment.id} className="record-row">
                      <span className="record-row__icon">
                        <Icon name="calendar" size={16} />
                      </span>
                      <div>
                        <strong>{titleCase(appointment.appointment_type)}</strong>
                        <small>
                          {formatDate(appointment.scheduled_at)} · {appointment.duration_minutes} min ·{" "}
                          {appointment.location ?? "Location TBD"}
                        </small>
                      </div>
                      <PlainBadge value={appointment.status} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {tab === "followups" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Follow-ups</h2>
                  <p>Keep the next action visible and owned.</p>
                </div>
                <button type="button" className="button button--primary" onClick={() => setAction("followup")}>
                  <Icon name="plus" size={14} /> Add follow-up
                </button>
              </header>
              {data.follow_ups.length === 0 ? (
                <EmptyState icon="followup" title="No follow-ups" description="Add a follow-up so this lead does not go cold." />
              ) : (
                <div className="record-list">
                  {data.follow_ups.map((followUp) => (
                    <div key={followUp.id} className="record-row">
                      <span className="record-row__icon">
                        <Icon name="followup" size={16} />
                      </span>
                      <div>
                        <strong>{followUp.note ?? `${titleCase(followUp.channel)} follow-up`}</strong>
                        <small>Due {formatDate(followUp.due_at)}</small>
                      </div>
                      <Badge tone={isOverdue(followUp.due_at) ? "danger" : "neutral"}>
                        {isOverdue(followUp.due_at) ? "Overdue" : titleCase(followUp.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>

        <aside className="detail-rail">
          <section className="card">
            <header className="card__header">
              <div>
                <h2>Quick actions</h2>
                <p>Log activity against this lead.</p>
              </div>
            </header>
            <div className="quick-actions">
              <button type="button" className="quick-action" onClick={() => setAction("note")}>
                <Icon name="note" size={16} />
                <span>
                  <strong>Add note</strong>
                  <small>Capture context</small>
                </span>
              </button>
              <button type="button" className="quick-action" onClick={() => logActivity("call_logged", "Logged a phone call", "Call logged.")}>
                <Icon name="phone" size={16} />
                <span>
                  <strong>Log a call</strong>
                  <small>Record the outcome</small>
                </span>
              </button>
              <button type="button" className="quick-action" onClick={() => setAction("followup")}>
                <Icon name="calendar" size={16} />
                <span>
                  <strong>Schedule follow-up</strong>
                  <small>Set the next action</small>
                </span>
              </button>
              <button
                type="button"
                className="quick-action"
                onClick={() =>
                  primaryConversation
                    ? navigate(`/inbox/${primaryConversation.id}`)
                    : navigate(`/inbox?lead=${data.id}`)
                }
              >
                <Icon name="whatsapp" size={16} />
                <span>
                  <strong>Open WhatsApp</strong>
                  <small>Reply in the inbox</small>
                </span>
              </button>
            </div>
          </section>

          <section className="card">
            <header className="card__header">
              <div>
                <h2>Contact</h2>
                <p>Lead record details.</p>
              </div>
            </header>
            <dl className="info-list">
              <div>
                <dt>Phone</dt>
                <dd>
                  <a href={`tel:${data.phone}`}>{data.phone}</a>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{data.email ? <a href={`mailto:${data.email}`}>{data.email}</a> : "—"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{owner?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt>Lead ID</dt>
                <dd className="mono">{data.id.slice(0, 8)}</dd>
              </div>
            </dl>
          </section>

          <p className="local-note">
            <Icon name="alert" size={14} /> Notes, status changes and follow-ups are saved locally
            until the write API is connected.
          </p>
        </aside>
      </div>

      {action === "note" ? (
        <Modal
          title="Add note"
          onClose={() => setAction(null)}
          footer={
            <>
              <button type="button" className="button" onClick={() => setAction(null)}>
                Cancel
              </button>
              <button type="submit" form="note-form" className="button button--primary">
                Save note
              </button>
            </>
          }
        >
          <form id="note-form" onSubmit={submitNote}>
            <label className="field">
              <span>Note</span>
              <textarea
                rows={5}
                autoFocus
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What happened? What is the next step?"
              />
            </label>
          </form>
        </Modal>
      ) : null}

      {action === "followup" ? (
        <Modal
          title="Schedule follow-up"
          onClose={() => setAction(null)}
          footer={
            <>
              <button type="button" className="button" onClick={() => setAction(null)}>
                Cancel
              </button>
              <button type="submit" form="followup-form" className="button button--primary">
                Schedule
              </button>
            </>
          }
        >
          <form id="followup-form" onSubmit={submitFollowUp} className="form-stack">
            <label className="field">
              <span>Due date & time</span>
              <input
                type="datetime-local"
                required
                autoFocus
                value={followUpAt}
                onChange={(event) => setFollowUpAt(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Note (optional)</span>
              <textarea
                rows={3}
                value={followUpNote}
                onChange={(event) => setFollowUpNote(event.target.value)}
                placeholder="e.g. Send the 3BHK brochure and confirm the visit"
              />
            </label>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
