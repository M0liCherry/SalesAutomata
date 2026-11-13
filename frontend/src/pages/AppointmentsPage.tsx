import { useMemo, useState } from "react";

import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { PageHeader } from "../components/PageHeader";
import { ErrorMessage, Loading } from "../components/Status";
import { useApi } from "../hooks/useApi";
import {
  formatClockTime,
  formatDay,
  titleCase,
  type Tone,
} from "../lib/constants";
import { useToast } from "../lib/toast";
import { formatDate } from "../format";
import type { Agent, Appointment, Lead, ListResponse } from "../types";
import "../styles/operations.css";

type View = "agenda" | "calendar";

interface AppointmentOverride {
  scheduled_at?: string;
  status?: string;
}

const APPOINTMENT_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
];

const APPOINTMENT_TYPES = ["site_visit", "call", "meeting", "virtual_tour"];

const STATUS_TONES: Record<string, Tone> = {
  scheduled: "info",
  completed: "success",
  cancelled: "danger",
  no_show: "warning",
  rescheduled: "accent",
};

function statusTone(status: string): Tone {
  return STATUS_TONES[status] ?? "neutral";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  const offset = (date.getDay() + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AppointmentsPage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("agenda");
  const [status, setStatus] = useState("");
  const [appointmentType, setAppointmentType] = useState("");
  const [upcoming, setUpcoming] = useState("");
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<Record<string, AppointmentOverride>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [newOpen, setNewOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const appointmentsApi = useApi<ListResponse<Appointment>>("/api/appointments", {
    status,
    appointment_type: appointmentType,
    upcoming,
    limit: 200,
    order: "scheduled_at.asc",
  });
  const agentsApi = useApi<ListResponse<Agent>>("/api/agents", { limit: 200 });
  const leadsApi = useApi<ListResponse<Lead>>("/api/leads", { limit: 200 });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agentsApi.data?.data ?? []) {
      map.set(agent.id, agent);
    }
    return map;
  }, [agentsApi.data]);

  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const lead of leadsApi.data?.data ?? []) {
      map.set(lead.id, lead);
    }
    return map;
  }, [leadsApi.data]);

  const appointments = useMemo(() => {
    return (appointmentsApi.data?.data ?? []).map((item) => {
      const override = overrides[item.id];
      if (!override) {
        return item;
      }
      const merged: Appointment = { ...item };
      if (override.scheduled_at) {
        merged.scheduled_at = override.scheduled_at;
      }
      if (override.status) {
        merged.status = override.status;
      }
      return merged;
    });
  }, [appointmentsApi.data, overrides]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return appointments;
    }
    return appointments.filter((item) => {
      const lead = leadMap.get(item.lead_id);
      return (
        (lead?.name ?? "").toLowerCase().includes(query) ||
        (lead?.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [appointments, leadMap, search]);

  const stats = useMemo(
    () => ({
      scheduled: appointments.filter((item) => item.status === "scheduled").length,
      completed: appointments.filter((item) => item.status === "completed").length,
      cancelled: appointments.filter((item) => item.status === "cancelled").length,
      noShow: appointments.filter((item) => item.status === "no_show").length,
    }),
    [appointments],
  );

  const agenda = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const item of visible) {
      const key = dateKey(item.scheduled_at);
      if (!key) {
        continue;
      }
      const items = map.get(key) ?? [];
      items.push(item);
      map.set(key, items);
    }
    for (const items of map.values()) {
      items.sort(
        (left, right) =>
          new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime(),
      );
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visible]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const weekAppointments = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const item of visible) {
      const key = dateKey(item.scheduled_at);
      if (!key) {
        continue;
      }
      const items = map.get(key) ?? [];
      items.push(item);
      map.set(key, items);
    }
    for (const items of map.values()) {
      items.sort(
        (left, right) =>
          new Date(left.scheduled_at).getTime() - new Date(right.scheduled_at).getTime(),
      );
    }
    return map;
  }, [visible]);

  const todayKey = dateKey(new Date());
  const weekEnd = addDays(weekStart, 6);
  const loading = appointmentsApi.loading || agentsApi.loading || leadsApi.loading;
  const error = appointmentsApi.error ?? agentsApi.error ?? leadsApi.error;

  const reloadAll = () => {
    void appointmentsApi.reload();
    void agentsApi.reload();
    void leadsApi.reload();
  };

  const resetFilters = () => {
    setStatus("");
    setAppointmentType("");
    setUpcoming("");
    setSearch("");
  };

  const leadLabel = (appointment: Appointment) => {
    const lead = leadMap.get(appointment.lead_id);
    return lead?.name ?? lead?.phone ?? "the lead";
  };

  const applyStatus = (appointment: Appointment, nextStatus: string, label: string) => {
    setOverrides((current) => ({
      ...current,
      [appointment.id]: { ...current[appointment.id], status: nextStatus },
    }));
    toast(
      `${leadLabel(appointment)} marked ${label}. Saved locally until the write API is connected.`,
      "warning",
    );
  };

  const openReschedule = (appointment: Appointment) => {
    setDetailId(null);
    setRescheduleTarget(appointment);
    setRescheduleValue(toDateTimeLocal(appointment.scheduled_at));
  };

  const saveReschedule = () => {
    if (!rescheduleTarget) {
      return;
    }
    const next = new Date(rescheduleValue);
    if (!rescheduleValue || Number.isNaN(next.getTime())) {
      toast("Choose a valid date and time.", "danger");
      return;
    }
    const iso = next.toISOString();
    setOverrides((current) => ({
      ...current,
      [rescheduleTarget.id]: {
        ...current[rescheduleTarget.id],
        scheduled_at: iso,
      },
    }));
    toast(
      `${leadLabel(rescheduleTarget)} rescheduled to ${formatDate(iso)}. Saved locally until the write API is connected.`,
      "warning",
    );
    setRescheduleTarget(null);
    setRescheduleValue("");
  };

  const renderActions = (appointment: Appointment) => (
    <div className="ops-card__actions">
      <button
        type="button"
        className="button button--sm"
        onClick={() => applyStatus(appointment, "completed", "completed")}
        disabled={appointment.status === "completed"}
      >
        <Icon name="check" size={13} /> Complete
      </button>
      <button
        type="button"
        className="button button--sm"
        onClick={() => applyStatus(appointment, "no_show", "as a no-show")}
        disabled={appointment.status === "no_show"}
      >
        <Icon name="pause" size={13} /> No-show
      </button>
      <button
        type="button"
        className="button button--sm"
        onClick={() => applyStatus(appointment, "cancelled", "cancelled")}
        disabled={appointment.status === "cancelled"}
      >
        <Icon name="x" size={13} /> Cancel
      </button>
      <button
        type="button"
        className="button button--sm button--ghost"
        onClick={() => openReschedule(appointment)}
      >
        <Icon name="clock" size={13} /> Reschedule
      </button>
    </div>
  );

  const renderCard = (appointment: Appointment) => {
    const lead = leadMap.get(appointment.lead_id);
    const agent = appointment.agent_id ? agentMap.get(appointment.agent_id) : null;
    return (
      <article key={appointment.id} className="ops-card">
        <div className="ops-card__top">
          <div className="ops-card__identity">
            <strong>{lead?.name ?? lead?.phone ?? "Unnamed lead"}</strong>
            <span>{lead?.phone ?? "No phone on file"}</span>
          </div>
          <div className="ops-card__badges">
            <Badge tone={statusTone(appointment.status)} dot>
              {titleCase(appointment.status)}
            </Badge>
            <Badge tone="neutral">{titleCase(appointment.appointment_type)}</Badge>
          </div>
        </div>
        <div className="ops-card__meta">
          <span>
            <Icon name="clock" size={13} />
            {formatDay(appointment.scheduled_at)} ·{" "}
            {formatClockTime(appointment.scheduled_at)} ·{" "}
            {appointment.duration_minutes} min
          </span>
          <span>
            <Icon name="user" size={13} />
            {agent?.name ?? "Unassigned agent"}
          </span>
          <span>
            <Icon name="mapPin" size={13} />
            {appointment.location ?? "Location not set"}
          </span>
        </div>
        {appointment.notes ? (
          <p className="ops-card__notes">{appointment.notes}</p>
        ) : null}
        {renderActions(appointment)}
      </article>
    );
  };

  const renderEvent = (appointment: Appointment) => {
    const lead = leadMap.get(appointment.lead_id);
    const label = lead?.name ?? lead?.phone ?? "Unnamed lead";
    return (
      <button
        key={appointment.id}
        type="button"
        className={`ops-event ops-event--${appointment.status}`}
        onClick={() => setDetailId(appointment.id)}
        title={`${label} · ${formatDay(appointment.scheduled_at)} ${formatClockTime(appointment.scheduled_at)}`}
      >
        <span className="ops-event__time">
          {formatClockTime(appointment.scheduled_at)}
        </span>
        <span className="ops-event__title">{label}</span>
        <span className="ops-event__type">
          {titleCase(appointment.appointment_type)}
        </span>
      </button>
    );
  };

  const detail = detailId
    ? (appointments.find((item) => item.id === detailId) ?? null)
    : null;
  const detailLead = detail ? leadMap.get(detail.lead_id) : null;
  const detailAgent =
    detail && detail.agent_id ? agentMap.get(detail.agent_id) : null;

  return (
    <>
      <div className="stack">
        <PageHeader
          title="Appointments"
          subtitle="Plan visits, keep agents aligned and track every scheduled conversation."
          actions={
            <button
              type="button"
              className="button button--primary"
              onClick={() => setNewOpen(true)}
            >
              <Icon name="plus" size={15} /> New appointment
            </button>
          }
        />

        <div className="stat-row">
          <div className="stat-chip">
            <span>Scheduled</span>
            <strong>{stats.scheduled}</strong>
          </div>
          <div className="stat-chip">
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
          <div className="stat-chip">
            <span>Cancelled</span>
            <strong>{stats.cancelled}</strong>
          </div>
          <div className="stat-chip">
            <span>No-show</span>
            <strong>{stats.noShow}</strong>
          </div>
        </div>

        <section className="ops-toolbar">
          <div className="ops-toolbar__filters">
            <label className="field field--inline ops-search">
              <span className="sr-only">Search appointments</span>
              <span className="input-with-icon">
                <Icon name="search" size={15} />
                <input
                  placeholder="Search lead name or phone"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </span>
            </label>
            <label className="field field--inline">
              <span className="sr-only">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                {APPOINTMENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--inline">
              <span className="sr-only">Appointment type</span>
              <select
                value={appointmentType}
                onChange={(event) => setAppointmentType(event.target.value)}
              >
                <option value="">All types</option>
                {APPOINTMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--inline">
              <span className="sr-only">Time range</span>
              <select
                value={upcoming}
                onChange={(event) => setUpcoming(event.target.value)}
              >
                <option value="">All times</option>
                <option value="true">Upcoming</option>
                <option value="false">Past</option>
              </select>
            </label>
            <button
              type="button"
              className="button button--ghost"
              onClick={resetFilters}
            >
              Reset
            </button>
          </div>

          <div className="ops-toolbar__views">
            <div className="segmented segmented--compact">
              <button
                type="button"
                className={
                  view === "agenda"
                    ? "segmented__item segmented__item--active"
                    : "segmented__item"
                }
                onClick={() => setView("agenda")}
              >
                <Icon name="list" size={14} /> Agenda
              </button>
              <button
                type="button"
                className={
                  view === "calendar"
                    ? "segmented__item segmented__item--active"
                    : "segmented__item"
                }
                onClick={() => setView("calendar")}
              >
                <Icon name="grid" size={14} /> Week
              </button>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={reloadAll}
              aria-label="Refresh appointments"
              disabled={loading}
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
        </section>

        {loading ? <Loading label="Loading appointments..." /> : null}
        {error ? <ErrorMessage message={error} onRetry={reloadAll} /> : null}

        {!loading && !error && visible.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No appointments match these filters"
            description="Adjust the filters or schedule a new appointment to fill the workbench."
            action={
              <button
                type="button"
                className="button button--primary"
                onClick={() => setNewOpen(true)}
              >
                <Icon name="plus" size={15} /> New appointment
              </button>
            }
          />
        ) : null}

        {!loading && !error && visible.length > 0 && view === "agenda" ? (
          <div className="ops-agenda">
            {agenda.map(([key, items]) => (
              <section key={key} className="ops-day">
                <header className="ops-day__header">
                  <h3>{formatDay(items[0].scheduled_at)}</h3>
                  <span className="ops-day__count">{items.length}</span>
                  {key === todayKey ? <Badge tone="info">Today</Badge> : null}
                </header>
                <div className="ops-day__cards">{items.map(renderCard)}</div>
              </section>
            ))}
          </div>
        ) : null}

        {!loading && !error && visible.length > 0 && view === "calendar" ? (
          <div className="ops-calendar">
            <div className="ops-calendar__toolbar">
              <button
                type="button"
                className="icon-button"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                aria-label="Previous week"
              >
                <Icon name="arrowLeft" size={16} />
              </button>
              <strong className="ops-calendar__range">
                {formatDay(weekStart.toISOString())} –{" "}
                {formatDay(weekEnd.toISOString())}
              </strong>
              <button
                type="button"
                className="button button--sm"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
              >
                Today
              </button>
              <span className="ops-calendar__spacer" />
              <button
                type="button"
                className="icon-button"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                aria-label="Next week"
              >
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
            <div className="ops-calendar__grid">
              {weekDays.map((day) => {
                const dayKey = dateKey(day);
                const items = weekAppointments.get(dayKey) ?? [];
                const shown = items.slice(0, 3);
                return (
                  <div
                    key={dayKey}
                    className={
                      dayKey === todayKey
                        ? "ops-calendar__day ops-calendar__day--today"
                        : "ops-calendar__day"
                    }
                  >
                    <header className="ops-calendar__day-header">
                      <span>
                        {day.toLocaleDateString(undefined, { weekday: "short" })}
                      </span>
                      <strong>{day.getDate()}</strong>
                    </header>
                    <div className="ops-calendar__events">
                      {shown.map(renderEvent)}
                      {items.length > shown.length ? (
                        <button
                          type="button"
                          className="ops-more"
                          onClick={() => setView("agenda")}
                        >
                          +{items.length - shown.length} more
                        </button>
                      ) : null}
                      {items.length === 0 ? (
                        <span className="ops-calendar__empty">No visits</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {newOpen ? (
        <Modal
          title="New appointment"
          onClose={() => setNewOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setNewOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="ops-new-appointment-form"
                className="button button--primary"
              >
                Create appointment
              </button>
            </>
          }
        >
          <form
            id="ops-new-appointment-form"
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const lead = leadMap.get(String(data.get("lead_id") ?? ""));
              toast(
                `Appointment for ${lead?.name ?? lead?.phone ?? "the lead"} staged. The write API is not connected yet, so nothing was saved.`,
                "warning",
              );
              setNewOpen(false);
            }}
          >
            <div className="form-grid">
              <label className="field ops-field--full">
                <span>Lead</span>
                <select name="lead_id" required defaultValue="">
                  <option value="" disabled>
                    Select a lead
                  </option>
                  {(leadsApi.data?.data ?? []).map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name ?? lead.phone}
                      {lead.name ? ` · ${lead.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Agent</span>
                <select name="agent_id" defaultValue="">
                  <option value="">Unassigned</option>
                  {(agentsApi.data?.data ?? []).map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Type</span>
                <select name="appointment_type" defaultValue="site_visit">
                  {APPOINTMENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {titleCase(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Scheduled at</span>
                <input
                  type="datetime-local"
                  name="scheduled_at"
                  required
                  defaultValue={toDateTimeLocal(
                    new Date(Date.now() + 3_600_000).toISOString(),
                  )}
                />
              </label>
              <label className="field">
                <span>Duration (minutes)</span>
                <input
                  type="number"
                  name="duration_minutes"
                  min={10}
                  step={5}
                  defaultValue={30}
                />
              </label>
              <label className="field ops-field--full">
                <span>Location</span>
                <input
                  name="location"
                  placeholder="Project site, office or call link"
                />
              </label>
              <label className="field ops-field--full">
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Anything the agent should know" />
              </label>
            </div>
          </form>
        </Modal>
      ) : null}

      {rescheduleTarget ? (
        <Modal
          title="Reschedule appointment"
          onClose={() => setRescheduleTarget(null)}
          footer={
            <>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setRescheduleTarget(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="ops-reschedule-appointment-form"
                className="button button--primary"
              >
                Save new time
              </button>
            </>
          }
        >
          <form
            id="ops-reschedule-appointment-form"
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              saveReschedule();
            }}
          >
            <p className="muted">
              {leadLabel(rescheduleTarget)} · currently{" "}
              {formatDate(rescheduleTarget.scheduled_at)}
            </p>
            <label className="field">
              <span>New date and time</span>
              <input
                type="datetime-local"
                value={rescheduleValue}
                onChange={(event) => setRescheduleValue(event.target.value)}
                required
              />
            </label>
          </form>
        </Modal>
      ) : null}

      {detail ? (
        <Modal
          title="Appointment details"
          onClose={() => setDetailId(null)}
          footer={
            <button
              type="button"
              className="button"
              onClick={() => setDetailId(null)}
            >
              Close
            </button>
          }
        >
          <div className="form-stack">
            <dl className="ops-detail">
              <dt>Lead</dt>
              <dd>{detailLead?.name ?? detailLead?.phone ?? "Unnamed lead"}</dd>
              <dt>Phone</dt>
              <dd>{detailLead?.phone ?? "—"}</dd>
              <dt>Agent</dt>
              <dd>{detailAgent?.name ?? "Unassigned"}</dd>
              <dt>Type</dt>
              <dd>{titleCase(detail.appointment_type)}</dd>
              <dt>Scheduled</dt>
              <dd>{formatDate(detail.scheduled_at)}</dd>
              <dt>Duration</dt>
              <dd>{detail.duration_minutes} minutes</dd>
              <dt>Location</dt>
              <dd>{detail.location ?? "—"}</dd>
              <dt>Status</dt>
              <dd>
                <Badge tone={statusTone(detail.status)} dot>
                  {titleCase(detail.status)}
                </Badge>
              </dd>
              <dt>Notes</dt>
              <dd>{detail.notes ?? "No notes"}</dd>
            </dl>
            {renderActions(detail)}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
