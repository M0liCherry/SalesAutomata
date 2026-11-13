import { useMemo } from "react";

import { Badge, ScoreBadge, StatusBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { PageHeader } from "../components/PageHeader";
import { ErrorMessage, Loading } from "../components/Status";
import { formatMoney } from "../format";
import { useApi } from "../hooks/useApi";
import {
  formatRelativeTime,
  initials,
  isOverdue,
  PIPELINE_STAGES,
  titleCase,
} from "../lib/constants";
import { navigate } from "../router";
import type {
  Appointment,
  DashboardSummary,
  FollowUp,
  Lead,
  ListResponse,
} from "../types";

export function DashboardPage() {
  const summary = useApi<DashboardSummary>("/api/dashboard/summary");
  const leads = useApi<ListResponse<Lead>>("/api/leads", {
    limit: 200,
    order: "created_at.desc",
  });
  const followUps = useApi<ListResponse<FollowUp>>("/api/follow-ups", {
    status: "pending",
    limit: 6,
    order: "due_at.asc",
  });
  const appointments = useApi<ListResponse<Appointment>>("/api/appointments", {
    upcoming: "true",
    limit: 6,
    order: "scheduled_at.asc",
  });

  const stats = summary.data;
  const leadRows = leads.data?.data ?? [];
  const totalLeads = stats?.leads.total ?? leadRows.length;
  const won = stats?.leads.won ?? 0;
  const conversion = totalLeads > 0 ? Math.round((won / totalLeads) * 100) : 0;
  const hotLeads = leadRows.filter((lead) => lead.qualification_score >= 70).length;
  const unassigned = leadRows.filter((lead) => !lead.assigned_agent_id).length;
  const overdue = (followUps.data?.data ?? []).filter((item) => isOverdue(item.due_at));

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leadRows) {
      counts.set(lead.source, (counts.get(lead.source) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [leadRows]);

  const funnel = useMemo(() => {
    const max = Math.max(1, stats?.leads.total ?? leadRows.length);
    return PIPELINE_STAGES.map((stage) => {
      const count = !stats
        ? leadRows.filter((lead) => lead.status === stage.value).length
        : stage.value === "new"
          ? stats.leads.new
            : stage.value === "contacted"
              ? stats.leads.contacted
              : stage.value === "qualified"
                ? stats.leads.qualified
                : stage.value === "site_visit_scheduled"
                  ? stats.leads.site_visit_scheduled
                  : stage.value === "negotiation"
                    ? stats.leads.negotiation
                    : stage.value === "won"
                      ? stats.leads.won
                      : stage.value === "lost"
                        ? stats.leads.lost
                        : leadRows.filter((lead) => lead.status === stage.value).length;
      return { ...stage, count, width: Math.max(4, Math.round((count / max) * 100)) };
    });
  }, [stats, leadRows]);

  return (
    <div className="stack">
      <PageHeader
        title="Sales command centre"
        subtitle="Today's pipeline, follow-ups and conversations at a glance."
        actions={
          <>
            <button type="button" className="button" onClick={() => navigate("/inbox")}>
              <Icon name="inbox" size={15} /> Open inbox
            </button>
            <button type="button" className="button button--primary" onClick={() => navigate("/leads")}>
              <Icon name="leads" size={15} /> View pipeline
            </button>
          </>
        }
      />

      {summary.loading ? <Loading label="Loading dashboard..." /> : null}
      {summary.error ? (
        <ErrorMessage message={summary.error} onRetry={() => void summary.reload()} />
      ) : null}

      <div className="kpi-grid">
        <KpiCard
          label="Total leads"
          value={totalLeads}
          hint={`${stats?.leads.new ?? 0} new in the pipeline`}
          icon="leads"
          tone="info"
        />
        <KpiCard
          label="Qualified"
          value={stats?.leads.qualified ?? 0}
          hint={`${hotLeads} lead${hotLeads === 1 ? "" : "s"} scoring 70+`}
          icon="sparkles"
          tone="warning"
        />
        <KpiCard
          label="Appointments"
          value={stats?.appointments.scheduled ?? 0}
          hint={`${stats?.leads.site_visit_scheduled ?? 0} leads in visit stage`}
          icon="calendar"
          tone="accent"
        />
        <KpiCard
          label="Won"
          value={won}
          hint={`${conversion}% conversion rate`}
          icon="check"
          tone="success"
        />
        <KpiCard
          label="Open chats"
          value={stats?.conversations.open ?? 0}
          hint={`${unassigned} unassigned leads`}
          icon="inbox"
          tone={overdue.length > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="dashboard-grid">
        <section className="card dashboard-grid__wide">
          <header className="card__header">
            <div>
              <h2>Pipeline funnel</h2>
              <p>Lead movement across the sales stages.</p>
            </div>
            <button type="button" className="button button--ghost" onClick={() => navigate("/leads")}>
              Open pipeline
            </button>
          </header>
          <div className="funnel">
            {funnel.map((stage) => (
              <div className="funnel__row" key={stage.value}>
                <span className="funnel__label">{stage.label}</span>
                <div className="funnel__track">
                  <span className={`funnel__bar stage-bg--${stage.tone}`} style={{ width: `${stage.width}%` }} />
                </div>
                <strong>{stage.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <header className="card__header">
            <div>
              <h2>Needs attention</h2>
              <p>Items that can slow conversion.</p>
            </div>
          </header>
          <div className="attention-list">
            <button type="button" className="attention-item" onClick={() => navigate("/follow-ups")}>
              <span className="attention-item__icon attention-item__icon--danger">
                <Icon name="followup" size={16} />
              </span>
              <span>
                <strong>{overdue.length} overdue follow-ups</strong>
                <small>Leads waiting for the next touch</small>
              </span>
              <Icon name="chevronRight" size={15} />
            </button>
            <button type="button" className="attention-item" onClick={() => navigate("/leads")}>
              <span className="attention-item__icon attention-item__icon--warning">
                <Icon name="user" size={16} />
              </span>
              <span>
                <strong>{unassigned} unassigned leads</strong>
                <small>Give every lead an owner</small>
              </span>
              <Icon name="chevronRight" size={15} />
            </button>
            <button type="button" className="attention-item" onClick={() => navigate("/inbox")}>
              <span className="attention-item__icon attention-item__icon--info">
                <Icon name="inbox" size={16} />
              </span>
              <span>
                <strong>{stats?.conversations.open ?? 0} open conversations</strong>
                <small>Reply before the lead goes cold</small>
              </span>
              <Icon name="chevronRight" size={15} />
            </button>
            <button type="button" className="attention-item" onClick={() => navigate("/appointments")}>
              <span className="attention-item__icon attention-item__icon--success">
                <Icon name="calendar" size={16} />
              </span>
              <span>
                <strong>{stats?.appointments.scheduled ?? 0} scheduled appointments</strong>
                <small>Confirm attendance and reminders</small>
              </span>
              <Icon name="chevronRight" size={15} />
            </button>
          </div>
        </section>

        <section className="card">
          <header className="card__header">
            <div>
              <h2>Today's agenda</h2>
              <p>Follow-ups and upcoming appointments.</p>
            </div>
          </header>
          <div className="agenda">
            <h3>Follow-ups</h3>
            {(followUps.data?.data ?? []).length === 0 ? (
              <p className="muted">Nothing scheduled.</p>
            ) : (
              (followUps.data?.data ?? []).slice(0, 4).map((followUp) => (
                <button
                  key={followUp.id}
                  type="button"
                  className="agenda-row"
                  onClick={() => navigate(`/leads/${followUp.lead_id}`)}
                >
                  <span className={`agenda-row__dot ${isOverdue(followUp.due_at) ? "agenda-row__dot--danger" : ""}`} />
                  <span>
                    <strong>{followUp.note ?? `${titleCase(followUp.channel)} follow-up`}</strong>
                    <small>{formatRelativeTime(followUp.due_at)}</small>
                  </span>
                  {isOverdue(followUp.due_at) ? <Badge tone="danger">Overdue</Badge> : null}
                </button>
              ))
            )}
            <h3>Appointments</h3>
            {(appointments.data?.data ?? []).length === 0 ? (
              <p className="muted">No upcoming appointments.</p>
            ) : (
              (appointments.data?.data ?? []).slice(0, 4).map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  className="agenda-row"
                  onClick={() => navigate(`/leads/${appointment.lead_id}`)}
                >
                  <span className="agenda-row__dot agenda-row__dot--info" />
                  <span>
                    <strong>{titleCase(appointment.appointment_type)}</strong>
                    <small>{formatRelativeTime(appointment.scheduled_at)}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <header className="card__header">
            <div>
              <h2>Lead sources</h2>
              <p>Where recent enquiries come from.</p>
            </div>
          </header>
          {sources.length === 0 ? (
            <p className="muted">No source data yet.</p>
          ) : (
            <div className="source-list">
              {sources.map(([source, count]) => {
                const percent = Math.max(4, Math.round((count / Math.max(1, leadRows.length)) * 100));
                return (
                  <div className="source-row" key={source}>
                    <span>{titleCase(source)}</span>
                    <div className="source-row__track">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <header className="card__header">
          <div>
            <h2>Recent leads</h2>
            <p>Latest enquiries entering the pipeline.</p>
          </div>
          <button type="button" className="button button--ghost" onClick={() => navigate("/leads")}>
            View all
          </button>
        </header>
        {leads.loading ? <Loading label="Loading recent leads..." /> : null}
        {leads.error ? <ErrorMessage message={leads.error} onRetry={() => void leads.reload()} /> : null}
        {!leads.loading && !leads.error && leadRows.length === 0 ? (
          <EmptyState icon="leads" title="No leads yet" description="Connect WhatsApp to start capturing enquiries." />
        ) : null}
        {leadRows.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Budget</th>
                  <th>City</th>
                  <th>Source</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {leadRows.slice(0, 7).map((lead) => (
                  <tr
                    key={lead.id}
                    className="data-table__row"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <td>
                      <div className="table-person">
                        <span className="avatar avatar--sm">{initials(lead.name, lead.phone.slice(-2))}</span>
                        <div>
                          <strong>{lead.name ?? "Unnamed lead"}</strong>
                          <small>{lead.phone}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={lead.status} />
                    </td>
                    <td>
                      <ScoreBadge score={lead.qualification_score} />
                    </td>
                    <td>{formatMoney(lead.budget_max)}</td>
                    <td>{lead.preferred_city ?? "—"}</td>
                    <td>{titleCase(lead.source)}</td>
                    <td>{formatRelativeTime(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
