import { useMemo, useState } from "react";

import { Badge, ScoreBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon, type IconName } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { ErrorMessage, Loading } from "../components/Status";
import { formatMoney } from "../format";
import { useApi } from "../hooks/useApi";
import {
  downloadCsv,
  isOverdue,
  PIPELINE_STAGES,
  titleCase,
} from "../lib/constants";
import type {
  Agent,
  Appointment,
  Conversation,
  DashboardSummary,
  FollowUp,
  Lead,
  ListResponse,
} from "../types";
import "../styles/analytics.css";

type RangeKey = "7" | "30" | "90" | "all";

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES: Array<{ value: RangeKey; label: string; days: number | null }> = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "all", label: "All time", days: null },
];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rate(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";
}

function appointmentTone(status: string): "info" | "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") {
    return "success";
  }
  if (status === "cancelled" || status === "no_show") {
    return "danger";
  }
  if (status === "rescheduled") {
    return "warning";
  }
  if (status === "scheduled") {
    return "info";
  }
  return "neutral";
}

function SectionStatus({
  loading,
  error,
  empty,
  emptyTitle,
  emptyDescription,
  emptyIcon = "inbox",
  loadingLabel = "Loading...",
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: IconName;
  loadingLabel?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return <Loading label={loadingLabel} />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }
  if (empty) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }
  return null;
}

export function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30");

  const summary = useApi<DashboardSummary>("/api/dashboard/summary");
  const leadsApi = useApi<ListResponse<Lead>>("/api/leads", {
    limit: 200,
    order: "created_at.desc",
  });
  const agentsApi = useApi<ListResponse<Agent>>("/api/agents", { limit: 200 });
  const appointmentsApi = useApi<ListResponse<Appointment>>("/api/appointments", {
    limit: 200,
    order: "scheduled_at.desc",
  });
  const followUpsApi = useApi<ListResponse<FollowUp>>("/api/follow-ups", { limit: 200 });
  const conversationsApi = useApi<ListResponse<Conversation>>("/api/conversations", {
    limit: 200,
  });

  const rangeLabel = RANGES.find((option) => option.value === range)?.label ?? "Last 30 days";
  const rangeDays = range === "all" ? null : Number(range);

  const filteredLeads = useMemo(() => {
    const rows = leadsApi.data?.data ?? [];
    if (rangeDays === null) {
      return rows;
    }
    const cutoff = Date.now() - rangeDays * DAY_MS;
    return rows.filter((lead) => new Date(lead.created_at).getTime() >= cutoff);
  }, [leadsApi.data, rangeDays]);

  const filteredAppointments = useMemo(() => {
    const rows = appointmentsApi.data?.data ?? [];
    if (rangeDays === null) {
      return rows;
    }
    const cutoff = Date.now() - rangeDays * DAY_MS;
    return rows.filter(
      (appointment) => new Date(appointment.scheduled_at).getTime() >= cutoff,
    );
  }, [appointmentsApi.data, rangeDays]);

  const metrics = useMemo(() => {
    const total = filteredLeads.length;
    const qualified = filteredLeads.filter((lead) => lead.status === "qualified").length;
    const wonLeads = filteredLeads.filter((lead) => lead.status === "won");
    const won = wonLeads.length;
    const wonValue = wonLeads.reduce(
      (sum, lead) => sum + (lead.budget_max ?? lead.budget_min ?? 0),
      0,
    );
    const scoreTotal = filteredLeads.reduce(
      (sum, lead) => sum + lead.qualification_score,
      0,
    );
    const hot = filteredLeads.filter((lead) => lead.qualification_score >= 70).length;
    return {
      total,
      qualified,
      won,
      wonValue,
      hot,
      averageScore: total > 0 ? Math.round(scoreTotal / total) : 0,
    };
  }, [filteredLeads]);

  const pipeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of filteredLeads) {
      counts.set(lead.status, (counts.get(lead.status) ?? 0) + 1);
    }
    const max = Math.max(
      1,
      ...PIPELINE_STAGES.map((stage) => counts.get(stage.value) ?? 0),
    );
    return PIPELINE_STAGES.map((stage) => {
      const count = counts.get(stage.value) ?? 0;
      return { ...stage, count, width: Math.round((count / max) * 100) };
    });
  }, [filteredLeads]);

  const sourceRows = useMemo(() => {
    const map = new Map<string, { leads: number; qualified: number; won: number }>();
    for (const lead of filteredLeads) {
      const entry = map.get(lead.source) ?? { leads: 0, qualified: 0, won: 0 };
      entry.leads += 1;
      if (lead.status === "qualified") {
        entry.qualified += 1;
      }
      if (lead.status === "won") {
        entry.won += 1;
      }
      map.set(lead.source, entry);
    }
    return [...map.entries()]
      .map(([source, row]) => ({ source, ...row }))
      .sort((left, right) => right.leads - left.leads || right.won - left.won);
  }, [filteredLeads]);

  const cityRows = useMemo(() => {
    const map = new Map<
      string,
      { city: string; leads: number; qualified: number; won: number }
    >();
    for (const lead of filteredLeads) {
      const city = lead.preferred_city?.trim();
      if (!city) {
        continue;
      }
      const key = city.toLowerCase();
      const entry = map.get(key) ?? { city, leads: 0, qualified: 0, won: 0 };
      entry.leads += 1;
      if (lead.status === "qualified") {
        entry.qualified += 1;
      }
      if (lead.status === "won") {
        entry.won += 1;
      }
      map.set(key, entry);
    }
    const rows = [...map.entries()]
      .map(([key, row]) => ({ key, ...row }))
      .sort((left, right) => right.leads - left.leads || right.won - left.won)
      .slice(0, 8);
    const max = Math.max(1, ...rows.map((row) => row.leads));
    return rows.map((row) => ({
      ...row,
      width: Math.round((row.leads / max) * 100),
    }));
  }, [filteredLeads]);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agentsApi.data?.data ?? []) {
      map.set(agent.id, agent);
    }
    return map;
  }, [agentsApi.data]);

  const agentRows = useMemo(() => {
    const map = new Map<
      string,
      { assigned: number; won: number; score: number; weight: number }
    >();
    for (const lead of filteredLeads) {
      if (!lead.assigned_agent_id) {
        continue;
      }
      const entry = map.get(lead.assigned_agent_id) ?? {
        assigned: 0,
        won: 0,
        score: 0,
        weight: 0,
      };
      const won = lead.status === "won";
      const weight = won ? 2 : 1;
      entry.assigned += 1;
      entry.won += won ? 1 : 0;
      entry.score += lead.qualification_score * weight;
      entry.weight += weight;
      map.set(lead.assigned_agent_id, entry);
    }
    return [...map.entries()]
      .map(([id, row]) => ({
        id,
        name: agentMap.get(id)?.name ?? "Unknown agent",
        assigned: row.assigned,
        won: row.won,
        weightedScore: row.weight > 0 ? Math.round(row.score / row.weight) : 0,
      }))
      .sort((left, right) => right.assigned - left.assigned || right.won - left.won);
  }, [filteredLeads, agentMap]);

  const trend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of filteredLeads) {
      const date = new Date(lead.created_at);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const key = dateKey(date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: Array<{ key: string; label: string; full: string; count: number }> = [];
    for (let index = 13; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      const key = dateKey(date);
      days.push({
        key,
        label: String(date.getDate()),
        full: date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        count: counts.get(key) ?? 0,
      });
    }
    const max = Math.max(1, ...days.map((day) => day.count));
    return days.map((day) => ({
      ...day,
      height: Math.max(day.count > 0 ? 6 : 2, Math.round((day.count / max) * 100)),
    }));
  }, [filteredLeads]);

  const appointmentRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const appointment of filteredAppointments) {
      map.set(appointment.status, (map.get(appointment.status) ?? 0) + 1);
    }
    const max = Math.max(1, ...map.values());
    return [...map.entries()]
      .map(([status, count]) => ({
        status,
        count,
        width: Math.round((count / max) * 100),
        tone: appointmentTone(status),
      }))
      .sort((left, right) => right.count - left.count);
  }, [filteredAppointments]);

  const followUpSla = useMemo(() => {
    const rows = followUpsApi.data?.data ?? [];
    const pending = rows.filter((row) => row.status === "pending");
    const overdue = pending.filter((row) => isOverdue(row.due_at)).length;
    const upcoming = pending.length - overdue;
    const completed = rows.filter((row) => row.status === "done").length;
    const skipped = rows.filter(
      (row) => row.status === "skipped" || row.status === "cancelled",
    ).length;
    const slaBase = completed + overdue;
    const total = Math.max(1, overdue + upcoming + completed);
    return {
      total: rows.length,
      overdue,
      upcoming,
      completed,
      skipped,
      sla: slaBase > 0 ? Math.round((completed / slaBase) * 100) : null,
      overdueWidth: (overdue / total) * 100,
      upcomingWidth: (upcoming / total) * 100,
      completedWidth: (completed / total) * 100,
    };
  }, [followUpsApi.data]);

  const conversationCount =
    conversationsApi.data?.count ?? conversationsApi.data?.data.length ?? 0;
  const leadsReady = !leadsApi.loading && !leadsApi.error;
  const agentsReady = !agentsApi.loading && !agentsApi.error;
  const appointmentsReady = !appointmentsApi.loading && !appointmentsApi.error;
  const followUpsReady = !followUpsApi.loading && !followUpsApi.error;
  const trendHasData = trend.some((day) => day.count > 0);
  const isRefreshing =
    summary.loading ||
    leadsApi.loading ||
    agentsApi.loading ||
    appointmentsApi.loading ||
    followUpsApi.loading ||
    conversationsApi.loading;

  const refreshAll = () => {
    void summary.reload();
    void leadsApi.reload();
    void agentsApi.reload();
    void appointmentsApi.reload();
    void followUpsApi.reload();
    void conversationsApi.reload();
  };

  const exportSources = () => {
    downloadCsv(
      `analytics-sources-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Source", "Leads", "Qualified", "Won", "Conversion"],
      sourceRows.map((row) => [
        row.source,
        row.leads,
        row.qualified,
        row.won,
        rate(row.won, row.leads),
      ]),
    );
  };

  return (
    <div className="stack">
      <PageHeader
        title="Analytics"
        subtitle="Pipeline health, acquisition quality and follow-up discipline for the selected window."
        actions={
          <button
            type="button"
            className="button"
            onClick={refreshAll}
            disabled={isRefreshing}
          >
            <Icon name="refresh" size={15} /> Refresh
          </button>
        }
      />

      <section className="analytics-toolbar">
        <div className="analytics-toolbar__group">
          <span className="analytics-toolbar__label">Date range</span>
          <div className="segmented segmented--compact" role="group" aria-label="Date range">
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  range === option.value
                    ? "segmented__item segmented__item--active"
                    : "segmented__item"
                }
                onClick={() => setRange(option.value)}
                aria-pressed={range === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="analytics-toolbar__group">
          <span className="analytics-toolbar__meta">
            {metrics.total} leads in range · {conversationCount} conversations loaded
          </span>
        </div>
      </section>

      {summary.error ? (
        <ErrorMessage
          message={`Workspace summary: ${summary.error}`}
          onRetry={() => void summary.reload()}
        />
      ) : null}

      <section className="analytics-section">
        <div className="analytics-section__head">
          <div>
            <h2>Key metrics</h2>
            <p>
              {rangeLabel} · {metrics.total} leads
            </p>
          </div>
        </div>
        <SectionStatus
          loading={leadsApi.loading}
          error={leadsApi.error}
          empty={leadsReady && metrics.total === 0}
          emptyTitle="No leads in this range"
          emptyDescription="Choose a wider date range or capture new enquiries to populate the report."
          emptyIcon="leads"
          loadingLabel="Loading lead metrics..."
          onRetry={() => void leadsApi.reload()}
        />
        {leadsReady && metrics.total > 0 ? (
          <div className="analytics-kpi-grid">
            <KpiCard
              label="Leads"
              value={metrics.total}
              hint={`${metrics.qualified} qualified`}
              icon="leads"
              tone="info"
            />
            <KpiCard
              label="Qualified"
              value={metrics.qualified}
              hint={`${rate(metrics.qualified, metrics.total)} of leads`}
              icon="sparkles"
              tone="warning"
            />
            <KpiCard
              label="Conversion"
              value={rate(metrics.won, metrics.total)}
              hint={`${metrics.won} won deals`}
              icon="check"
              tone="success"
            />
            <KpiCard
              label="Appointments"
              value={appointmentsApi.loading ? "…" : filteredAppointments.length}
              hint={`${summary.data?.appointments.scheduled ?? 0} scheduled all-time`}
              icon="calendar"
              tone="accent"
            />
            <KpiCard
              label="Won value"
              value={metrics.wonValue > 0 ? formatMoney(metrics.wonValue) : metrics.won}
              hint={
                metrics.wonValue > 0
                  ? `${metrics.won} deals with budget`
                  : `${metrics.won} won leads`
              }
              icon="property"
              tone="success"
            />
            <KpiCard
              label="Avg. score"
              value={metrics.averageScore}
              hint={`${metrics.hot} leads scoring 70+`}
              icon="activity"
              tone="neutral"
            />
          </div>
        ) : null}
      </section>

      <div className="analytics-grid analytics-grid--two">
        <section className="card">
          <header className="card__header">
            <div>
              <h2>Pipeline distribution</h2>
              <p>Leads by stage in the selected window.</p>
            </div>
            <Badge tone="neutral">{metrics.total} leads</Badge>
          </header>
          <SectionStatus
            loading={leadsApi.loading}
            error={leadsApi.error}
            empty={leadsReady && metrics.total === 0}
            emptyTitle="No pipeline activity"
            emptyDescription="Leads in the selected range will appear here by stage."
            emptyIcon="leads"
            loadingLabel="Loading pipeline..."
            onRetry={() => void leadsApi.reload()}
          />
          {leadsReady && metrics.total > 0 ? (
            <div className="analytics-stage-list">
              {pipeline.map((stage) => (
                <div className="analytics-stage-row" key={stage.value}>
                  <span className="analytics-stage-label">{stage.label}</span>
                  <div className="analytics-stage-track">
                    <span
                      className={`analytics-stage-bar stage-bg--${stage.tone}`}
                      style={{ width: `${stage.width}%` }}
                    />
                  </div>
                  <strong className="analytics-num">{stage.count}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <header className="card__header">
            <div>
              <h2>Appointment status</h2>
              <p>Status mix for appointments in the selected window.</p>
            </div>
          </header>
          <SectionStatus
            loading={appointmentsApi.loading}
            error={appointmentsApi.error}
            empty={appointmentsReady && filteredAppointments.length === 0}
            emptyTitle="No appointments in this range"
            emptyDescription="Booked visits and calls will be grouped by status here."
            emptyIcon="calendar"
            loadingLabel="Loading appointments..."
            onRetry={() => void appointmentsApi.reload()}
          />
          {appointmentsReady && filteredAppointments.length > 0 ? (
            <div className="analytics-status-list">
              {appointmentRows.map((row) => (
                <div className="analytics-status-row" key={row.status}>
                  <span className="analytics-status-label">{titleCase(row.status)}</span>
                  <div className="analytics-status-track">
                    <span
                      className={`analytics-status-bar stage-bg--${row.tone}`}
                      style={{ width: `${row.width}%` }}
                    />
                  </div>
                  <strong className="analytics-num">{row.count}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="analytics-grid analytics-grid--two">
        <section className="card">
          <header className="card__header">
            <div>
              <h2>Daily lead trend</h2>
              <p>New leads per day over the last 14 days.</p>
            </div>
          </header>
          <SectionStatus
            loading={leadsApi.loading}
            error={leadsApi.error}
            empty={leadsReady && !trendHasData}
            emptyTitle="No recent lead activity"
            emptyDescription="New enquiries from the last 14 days will be charted here."
            emptyIcon="activity"
            loadingLabel="Loading trend..."
            onRetry={() => void leadsApi.reload()}
          />
          {leadsReady && trendHasData ? (
            <div className="analytics-trend">
              {trend.map((day) => (
                <div
                  className="analytics-trend__col"
                  key={day.key}
                  title={`${day.full}: ${day.count} lead${day.count === 1 ? "" : "s"}`}
                >
                  <span className="analytics-trend__value">{day.count}</span>
                  <div className="analytics-trend__plot">
                    <span
                      className={
                        day.count === 0
                          ? "analytics-trend__bar analytics-trend__bar--empty"
                          : "analytics-trend__bar"
                      }
                      style={{ height: `${day.height}%` }}
                    />
                  </div>
                  <span className="analytics-trend__label">{day.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <header className="card__header">
            <div>
              <h2>Follow-up SLA</h2>
              <p>Overdue pending items against completed follow-ups.</p>
            </div>
          </header>
          <SectionStatus
            loading={followUpsApi.loading}
            error={followUpsApi.error}
            empty={followUpsReady && followUpSla.total === 0}
            emptyTitle="No follow-ups recorded"
            emptyDescription="Pending and completed follow-ups will be summarised here."
            emptyIcon="followup"
            loadingLabel="Loading follow-ups..."
            onRetry={() => void followUpsApi.reload()}
          />
          {followUpsReady && followUpSla.total > 0 ? (
            <div className="analytics-sla">
              <div className="analytics-sla__score">
                <strong className="analytics-sla__value">
                  {followUpSla.sla === null ? "—" : `${followUpSla.sla}%`}
                </strong>
                <span className="analytics-sla__caption">
                  Completed vs overdue pending
                </span>
              </div>
              <div className="analytics-sla__bar">
                {followUpSla.overdue > 0 ? (
                  <span
                    className="analytics-sla__segment analytics-sla__segment--overdue"
                    style={{ width: `${followUpSla.overdueWidth}%` }}
                  />
                ) : null}
                {followUpSla.upcoming > 0 ? (
                  <span
                    className="analytics-sla__segment analytics-sla__segment--upcoming"
                    style={{ width: `${followUpSla.upcomingWidth}%` }}
                  />
                ) : null}
                {followUpSla.completed > 0 ? (
                  <span
                    className="analytics-sla__segment analytics-sla__segment--completed"
                    style={{ width: `${followUpSla.completedWidth}%` }}
                  />
                ) : null}
              </div>
              <div className="analytics-sla__legend">
                <span>
                  <span className="analytics-sla__dot analytics-sla__dot--overdue" />
                  {followUpSla.overdue} overdue
                </span>
                <span>
                  <span className="analytics-sla__dot analytics-sla__dot--upcoming" />
                  {followUpSla.upcoming} upcoming
                </span>
                <span>
                  <span className="analytics-sla__dot analytics-sla__dot--completed" />
                  {followUpSla.completed} completed
                </span>
              </div>
              {followUpSla.skipped > 0 ? (
                <p className="analytics-sla__note">
                  {followUpSla.skipped} skipped or cancelled
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <section className="card">
        <header className="card__header">
          <div>
            <h2>Source performance</h2>
            <p>Lead volume, qualification and wins by acquisition channel.</p>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={exportSources}
            disabled={sourceRows.length === 0 || !leadsReady}
          >
            <Icon name="download" size={15} /> Export CSV
          </button>
        </header>
        <SectionStatus
          loading={leadsApi.loading}
          error={leadsApi.error}
          empty={leadsReady && sourceRows.length === 0}
          emptyTitle="No source data yet"
          emptyDescription="Lead sources will be compared once enquiries are captured."
          emptyIcon="activity"
          loadingLabel="Loading source performance..."
          onRetry={() => void leadsApi.reload()}
        />
        {leadsReady && sourceRows.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th className="analytics-num">Leads</th>
                  <th className="analytics-num">Qualified</th>
                  <th className="analytics-num">Won</th>
                  <th className="analytics-num">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((row) => (
                  <tr key={row.source}>
                    <td>{titleCase(row.source)}</td>
                    <td className="analytics-num">{row.leads}</td>
                    <td className="analytics-num">{row.qualified}</td>
                    <td className="analytics-num">{row.won}</td>
                    <td className="analytics-num">{rate(row.won, row.leads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <div className="analytics-grid analytics-grid--two">
        <section className="card">
          <header className="card__header">
            <div>
              <h2>City performance</h2>
              <p>Top preferred cities by lead volume and conversion.</p>
            </div>
          </header>
          <SectionStatus
            loading={leadsApi.loading}
            error={leadsApi.error}
            empty={leadsReady && cityRows.length === 0}
            emptyTitle="No city data in this range"
            emptyDescription="Preferred cities from qualified enquiries will appear here."
            emptyIcon="mapPin"
            loadingLabel="Loading city performance..."
            onRetry={() => void leadsApi.reload()}
          />
          {leadsReady && cityRows.length > 0 ? (
            <div className="analytics-city-list">
              {cityRows.map((row) => (
                <div className="analytics-city-row" key={row.key}>
                  <span className="analytics-city-name">{titleCase(row.city)}</span>
                  <div className="analytics-city-track">
                    <span style={{ width: `${row.width}%` }} />
                  </div>
                  <strong className="analytics-num">{row.leads}</strong>
                  <span className="analytics-city-rate">{rate(row.won, row.leads)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <header className="card__header">
            <div>
              <h2>Agent performance</h2>
              <p>Assigned leads, wins and weighted quality score.</p>
            </div>
          </header>
          <SectionStatus
            loading={leadsApi.loading || agentsApi.loading}
            error={agentsApi.error ?? leadsApi.error}
            empty={leadsReady && agentsReady && agentRows.length === 0}
            emptyTitle="No assigned leads"
            emptyDescription="Leads with an owner will show agent conversion and quality."
            emptyIcon="agents"
            loadingLabel="Loading agent performance..."
            onRetry={() => {
              void leadsApi.reload();
              void agentsApi.reload();
            }}
          />
          {leadsReady && agentsReady && agentRows.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th className="analytics-num">Assigned</th>
                    <th className="analytics-num">Won</th>
                    <th className="analytics-num">Conversion</th>
                    <th className="analytics-num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="analytics-agent-name">{row.name}</span>
                      </td>
                      <td className="analytics-num">{row.assigned}</td>
                      <td className="analytics-num">{row.won}</td>
                      <td className="analytics-num">{rate(row.won, row.assigned)}</td>
                      <td className="analytics-num">
                        <ScoreBadge score={row.weightedScore} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
