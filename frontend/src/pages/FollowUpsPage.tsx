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
  formatRelativeTime,
  isOverdue,
  titleCase,
  type Tone,
} from "../lib/constants";
import { useToast } from "../lib/toast";
import { formatDate } from "../format";
import type { FollowUp, Lead, ListResponse } from "../types";
import "../styles/operations.css";

interface FollowUpOverride {
  due_at?: string;
  status?: string;
}

const FOLLOW_UP_STATUSES = ["pending", "done", "skipped", "cancelled"];
const FOLLOW_UP_CHANNELS = ["whatsapp", "phone", "email", "sms"];

const STATUS_TONES: Record<string, Tone> = {
  pending: "warning",
  done: "success",
  skipped: "neutral",
  cancelled: "danger",
};

function statusTone(status: string, overdue: boolean): Tone {
  if (status === "pending" && overdue) {
    return "danger";
  }
  return STATUS_TONES[status] ?? "neutral";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
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

export function FollowUpsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [dueBefore, setDueBefore] = useState("");
  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<Record<string, FollowUpOverride>>({});
  const [rescheduleTarget, setRescheduleTarget] = useState<FollowUp | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const followUpsApi = useApi<ListResponse<FollowUp>>("/api/follow-ups", {
    status,
    channel,
    due_before: dueBefore,
    limit: 200,
    order: "due_at.asc",
  });
  const leadsApi = useApi<ListResponse<Lead>>("/api/leads", { limit: 200 });

  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const lead of leadsApi.data?.data ?? []) {
      map.set(lead.id, lead);
    }
    return map;
  }, [leadsApi.data]);

  const followUps = useMemo(() => {
    return (followUpsApi.data?.data ?? []).map((item) => {
      const override = overrides[item.id];
      if (!override) {
        return item;
      }
      const merged: FollowUp = { ...item };
      if (override.due_at) {
        merged.due_at = override.due_at;
      }
      if (override.status) {
        merged.status = override.status;
      }
      return merged;
    });
  }, [followUpsApi.data, overrides]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return followUps;
    }
    return followUps.filter((item) => {
      const lead = leadMap.get(item.lead_id);
      return (
        (lead?.name ?? "").toLowerCase().includes(query) ||
        (lead?.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [followUps, leadMap, search]);

  const stats = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const tomorrowStart = addDays(startOfDay(new Date()), 1).getTime();
    let overdue = 0;
    let dueToday = 0;
    let upcoming = 0;
    let done = 0;
    for (const item of followUps) {
      if (item.status === "done") {
        done += 1;
        continue;
      }
      if (item.status !== "pending") {
        continue;
      }
      const due = new Date(item.due_at).getTime();
      if (Number.isNaN(due)) {
        continue;
      }
      if (due < todayStart) {
        overdue += 1;
      } else if (due < tomorrowStart) {
        dueToday += 1;
      } else {
        upcoming += 1;
      }
    }
    return { overdue, dueToday, upcoming, done };
  }, [followUps]);

  const groups = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const tomorrowStart = addDays(startOfDay(new Date()), 1).getTime();
    const overdue: FollowUp[] = [];
    const today: FollowUp[] = [];
    const upcoming: FollowUp[] = [];
    const done: FollowUp[] = [];
    for (const item of visible) {
      if (item.status !== "pending") {
        done.push(item);
        continue;
      }
      const due = new Date(item.due_at).getTime();
      if (Number.isNaN(due) || due >= tomorrowStart) {
        upcoming.push(item);
      } else if (due < todayStart) {
        overdue.push(item);
      } else {
        today.push(item);
      }
    }
    return [
      { key: "overdue", label: "Overdue", tone: "danger" as Tone, items: overdue },
      { key: "today", label: "Today", tone: "warning" as Tone, items: today },
      { key: "upcoming", label: "Upcoming", tone: "info" as Tone, items: upcoming },
      { key: "done", label: "Done", tone: "success" as Tone, items: done },
    ];
  }, [visible]);

  const loading = followUpsApi.loading || leadsApi.loading;
  const error = followUpsApi.error ?? leadsApi.error;

  const reloadAll = () => {
    void followUpsApi.reload();
    void leadsApi.reload();
  };

  const resetFilters = () => {
    setStatus("");
    setChannel("");
    setDueBefore("");
    setSearch("");
  };

  const leadLabel = (item: FollowUp) => {
    const lead = leadMap.get(item.lead_id);
    return lead?.name ?? lead?.phone ?? "the lead";
  };

  const applyStatus = (item: FollowUp, nextStatus: string, label: string) => {
    setOverrides((current) => ({
      ...current,
      [item.id]: { ...current[item.id], status: nextStatus },
    }));
    toast(
      `Follow-up for ${leadLabel(item)} marked ${label}. Saved locally until the write API is connected.`,
      "warning",
    );
  };

  const snoozeOneDay = (item: FollowUp) => {
    const current = new Date(item.due_at);
    const base = Number.isNaN(current.getTime()) ? new Date() : current;
    base.setDate(base.getDate() + 1);
    const iso = base.toISOString();
    setOverrides((state) => ({
      ...state,
      [item.id]: { ...state[item.id], due_at: iso },
    }));
    toast(
      `Follow-up for ${leadLabel(item)} snoozed to ${formatDate(iso)}. Saved locally until the write API is connected.`,
      "warning",
    );
  };

  const openReschedule = (item: FollowUp) => {
    setRescheduleTarget(item);
    setRescheduleValue(toDateTimeLocal(item.due_at));
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
        due_at: iso,
      },
    }));
    toast(
      `Follow-up for ${leadLabel(rescheduleTarget)} rescheduled to ${formatDate(iso)}. Saved locally until the write API is connected.`,
      "warning",
    );
    setRescheduleTarget(null);
    setRescheduleValue("");
  };

  const renderCard = (item: FollowUp) => {
    const lead = leadMap.get(item.lead_id);
    const overdue = item.status === "pending" && isOverdue(item.due_at);
    return (
      <article
        key={item.id}
        className={overdue ? "ops-card ops-card--overdue" : "ops-card"}
      >
        <div className="ops-card__top">
          <div className="ops-card__identity">
            <strong>{lead?.name ?? lead?.phone ?? "Unnamed lead"}</strong>
            <span>{lead?.phone ?? "No phone on file"}</span>
          </div>
          <div className="ops-card__badges">
            <Badge tone="neutral">{titleCase(item.channel)}</Badge>
            <Badge tone={statusTone(item.status, overdue)} dot>
              {titleCase(item.status)}
            </Badge>
          </div>
        </div>
        <div className="ops-card__meta">
          <span>
            <Icon name="clock" size={13} />
            {formatDay(item.due_at)} · {formatClockTime(item.due_at)} ·{" "}
            {formatRelativeTime(item.due_at)}
          </span>
          <span>
            <Icon name="user" size={13} />
            Created by {item.created_by}
          </span>
        </div>
        {item.note ? <p className="ops-card__notes">{item.note}</p> : null}
        <div className="ops-card__actions">
          <button
            type="button"
            className="button button--sm"
            onClick={() => applyStatus(item, "done", "done")}
            disabled={item.status === "done"}
          >
            <Icon name="check" size={13} /> Done
          </button>
          <button
            type="button"
            className="button button--sm"
            onClick={() => snoozeOneDay(item)}
            disabled={item.status === "done"}
          >
            <Icon name="refresh" size={13} /> Snooze 1 day
          </button>
          <button
            type="button"
            className="button button--sm button--ghost"
            onClick={() => openReschedule(item)}
          >
            <Icon name="clock" size={13} /> Reschedule
          </button>
        </div>
      </article>
    );
  };

  return (
    <>
      <div className="stack">
        <PageHeader
          title="Follow-ups"
          subtitle="Keep every promised callback visible and close the loop on time."
          actions={
            <button
              type="button"
              className="button button--primary"
              onClick={() => setAddOpen(true)}
            >
              <Icon name="plus" size={15} /> Add follow-up
            </button>
          }
        />

        <div className="stat-row">
          <div className="stat-chip">
            <span>Overdue</span>
            <strong>{stats.overdue}</strong>
          </div>
          <div className="stat-chip">
            <span>Due today</span>
            <strong>{stats.dueToday}</strong>
          </div>
          <div className="stat-chip">
            <span>Upcoming</span>
            <strong>{stats.upcoming}</strong>
          </div>
          <div className="stat-chip">
            <span>Done</span>
            <strong>{stats.done}</strong>
          </div>
        </div>

        <section className="ops-toolbar">
          <div className="ops-toolbar__filters">
            <label className="field field--inline ops-search">
              <span className="sr-only">Search follow-ups</span>
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
                {FOLLOW_UP_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--inline">
              <span className="sr-only">Channel</span>
              <select
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
              >
                <option value="">All channels</option>
                {FOLLOW_UP_CHANNELS.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--inline">
              <span className="sr-only">Due before</span>
              <input
                type="date"
                value={dueBefore}
                onChange={(event) => setDueBefore(event.target.value)}
              />
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
            <span className="muted">
              Today is {formatDay(new Date().toISOString())}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={reloadAll}
              aria-label="Refresh follow-ups"
              disabled={loading}
            >
              <Icon name="refresh" size={16} />
            </button>
          </div>
        </section>

        {loading ? <Loading label="Loading follow-ups..." /> : null}
        {error ? <ErrorMessage message={error} onRetry={reloadAll} /> : null}

        {!loading && !error && visible.length === 0 ? (
          <EmptyState
            icon="followup"
            title="No follow-ups match these filters"
            description="Adjust the filters or add a follow-up to keep the next conversation moving."
            action={
              <button
                type="button"
                className="button button--primary"
                onClick={() => setAddOpen(true)}
              >
                <Icon name="plus" size={15} /> Add follow-up
              </button>
            }
          />
        ) : null}

        {!loading && !error && visible.length > 0 ? (
          <div className="ops-groups">
            {groups.map((group) => (
              <section key={group.key} className="ops-group">
                <header className="ops-group__header">
                  <span className={`stage-dot stage-dot--${group.tone}`} />
                  <h2>{group.label}</h2>
                  <span className="ops-group__count">{group.items.length}</span>
                </header>
                {group.items.length > 0 ? (
                  <div className="ops-group__cards">
                    {group.items.map(renderCard)}
                  </div>
                ) : (
                  <p className="ops-group__empty">No follow-ups in this bucket.</p>
                )}
              </section>
            ))}
          </div>
        ) : null}
      </div>

      {addOpen ? (
        <Modal
          title="Add follow-up"
          onClose={() => setAddOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="ops-new-follow-up-form"
                className="button button--primary"
              >
                Add follow-up
              </button>
            </>
          }
        >
          <form
            id="ops-new-follow-up-form"
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const lead = leadMap.get(String(data.get("lead_id") ?? ""));
              toast(
                `Follow-up for ${lead?.name ?? lead?.phone ?? "the lead"} staged. The write API is not connected yet, so nothing was saved.`,
                "warning",
              );
              setAddOpen(false);
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
                <span>Channel</span>
                <select name="channel" defaultValue="whatsapp">
                  {FOLLOW_UP_CHANNELS.map((value) => (
                    <option key={value} value={value}>
                      {titleCase(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Due at</span>
                <input
                  type="datetime-local"
                  name="due_at"
                  required
                  defaultValue={toDateTimeLocal(
                    new Date(Date.now() + 3_600_000).toISOString(),
                  )}
                />
              </label>
              <label className="field ops-field--full">
                <span>Note</span>
                <textarea
                  name="note"
                  rows={3}
                  placeholder="What should the agent follow up on?"
                />
              </label>
            </div>
          </form>
        </Modal>
      ) : null}

      {rescheduleTarget ? (
        <Modal
          title="Reschedule follow-up"
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
                form="ops-reschedule-follow-up-form"
                className="button button--primary"
              >
                Save new time
              </button>
            </>
          }
        >
          <form
            id="ops-reschedule-follow-up-form"
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              saveReschedule();
            }}
          >
            <p className="muted">
              {leadLabel(rescheduleTarget)} · currently{" "}
              {formatDate(rescheduleTarget.due_at)}
            </p>
            <label className="field">
              <span>New due date and time</span>
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
    </>
  );
}
