import { useMemo, useState, type DragEvent } from "react";

import { Badge, ScoreBadge, StatusBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { ErrorMessage, Loading } from "../components/Status";
import { useApi } from "../hooks/useApi";
import {
  budgetRange,
  downloadCsv,
  formatRelativeTime,
  initials,
  LEAD_SOURCES,
  PIPELINE_STAGES,
  findStage,
  titleCase,
} from "../lib/constants";
import { getLocalLeadStatuses, setLocalLeadStatus } from "../lib/storage";
import { useToast } from "../lib/toast";
import { navigate } from "../router";
import type { Agent, Lead, ListResponse } from "../types";
import { formatMoney, text } from "../format";

type View = "pipeline" | "list";

interface Filters {
  search: string;
  status: string;
  source: string;
  agent: string;
  min_score: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  status: "",
  source: "",
  agent: "",
  min_score: "",
};

export function LeadsPage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("pipeline");
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [version, setVersion] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const leadsApi = useApi<ListResponse<Lead>>("/api/leads", {
    search: applied.search,
    status: applied.status,
    source: applied.source,
    assigned_agent_id: applied.agent,
    min_score: applied.min_score,
    limit: 200,
    order: "created_at.desc",
  });

  const agentsApi = useApi<ListResponse<Agent>>("/api/agents", { limit: 200 });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agentsApi.data?.data ?? []) {
      map.set(agent.id, agent);
    }
    return map;
  }, [agentsApi.data]);

  const localStatuses = useMemo(() => getLocalLeadStatuses(), [version]);

  const leads = useMemo(() => {
    const rows = leadsApi.data?.data ?? [];
    return rows.map((lead) =>
      localStatuses[lead.id] ? { ...lead, status: localStatuses[lead.id] } : lead,
    );
  }, [leadsApi.data, localStatuses]);

  const stats = useMemo(() => {
    const hot = leads.filter((lead) => lead.qualification_score >= 70).length;
    const unassigned = leads.filter((lead) => !lead.assigned_agent_id).length;
    const newLeads = leads.filter((lead) => lead.status === "new").length;
    const localChanges = leads.filter((lead) => localStatuses[lead.id]).length;
    return { hot, unassigned, newLeads, localChanges };
  }, [leads, localStatuses]);

  const grouped = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const stage of PIPELINE_STAGES) {
      map.set(stage.value, []);
    }
    for (const lead of leads) {
      map.set(lead.status, [...(map.get(lead.status) ?? []), lead]);
    }
    return map;
  }, [leads]);

  const applyFilters = () => setApplied({ ...draft });
  const resetFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  };

  const moveLead = (leadId: string, status: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.status === status) {
      return;
    }
    setLocalLeadStatus(leadId, status);
    setVersion((current) => current + 1);
    toast(
      `${lead.name ?? lead.phone} moved to ${findStage(status).label}. Saved locally until the write API is connected.`,
      "warning",
    );
  };

  const onDrop = (event: DragEvent<HTMLDivElement>, status: string) => {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/lead-id") || draggingId;
    setDropTarget(null);
    setDraggingId(null);
    if (leadId) {
      moveLead(leadId, status);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `leads-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Phone", "Email", "Status", "Source", "Score", "City", "Budget", "Owner", "Created"],
      leads.map((lead) => [
        lead.name ?? "",
        lead.phone,
        lead.email ?? "",
        lead.status,
        lead.source,
        lead.qualification_score,
        lead.preferred_city ?? "",
        lead.budget_max ?? "",
        agentMap.get(lead.assigned_agent_id ?? "")?.name ?? "",
        lead.created_at,
      ]),
    );
    toast(`Exported ${leads.length} leads.`, "success");
  };

  return (
    <div className="stack">
      <PageHeader
        title="Leads"
        subtitle="Qualify enquiries, move deals forward and keep every follow-up visible."
        actions={
          <>
            <button type="button" className="button" onClick={exportCsv} disabled={leads.length === 0}>
              <Icon name="download" size={15} /> Export
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => toast("Lead creation will use the backend write API when it is connected.", "warning")}
            >
              <Icon name="plus" size={15} /> New lead
            </button>
          </>
        }
      />

      <div className="stat-row">
        <div className="stat-chip">
          <span>Total leads</span>
          <strong>{leadsApi.data?.count ?? leads.length}</strong>
        </div>
        <div className="stat-chip">
          <span>New</span>
          <strong>{stats.newLeads}</strong>
        </div>
        <div className="stat-chip">
          <span>Hot (70+)</span>
          <strong>{stats.hot}</strong>
        </div>
        <div className="stat-chip">
          <span>Unassigned</span>
          <strong>{stats.unassigned}</strong>
        </div>
        {stats.localChanges > 0 ? (
          <div className="stat-chip stat-chip--warning">
            <span>Local changes</span>
            <strong>{stats.localChanges}</strong>
          </div>
        ) : null}
      </div>

      <section className="toolbar">
        <form
          className="toolbar__filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <label className="field field--inline field--grow">
            <span className="sr-only">Search leads</span>
            <span className="input-with-icon">
              <Icon name="search" size={15} />
              <input
                placeholder="Search name, phone or email"
                value={draft.search}
                onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              />
            </span>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Status</span>
            <select
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
            >
              <option value="">All statuses</option>
              {PIPELINE_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Source</span>
            <select
              value={draft.source}
              onChange={(event) => setDraft({ ...draft, source: event.target.value })}
            >
              <option value="">All sources</option>
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {titleCase(source)}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Owner</span>
            <select
              value={draft.agent}
              onChange={(event) => setDraft({ ...draft, agent: event.target.value })}
            >
              <option value="">All agents</option>
              {(agentsApi.data?.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Score</span>
            <select
              value={draft.min_score}
              onChange={(event) => setDraft({ ...draft, min_score: event.target.value })}
            >
              <option value="">Any score</option>
              <option value="45">Warm (45+)</option>
              <option value="70">Hot (70+)</option>
              <option value="85">Very hot (85+)</option>
            </select>
          </label>
          <button type="submit" className="button">
            Apply
          </button>
          <button type="button" className="button button--ghost" onClick={resetFilters}>
            Reset
          </button>
        </form>

        <div className="toolbar__views">
          <div className="segmented segmented--compact">
            <button
              type="button"
              className={view === "pipeline" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => setView("pipeline")}
            >
              <Icon name="grid" size={14} /> Pipeline
            </button>
            <button
              type="button"
              className={view === "list" ? "segmented__item segmented__item--active" : "segmented__item"}
              onClick={() => setView("list")}
            >
              <Icon name="list" size={14} /> List
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => void leadsApi.reload()}
            aria-label="Refresh leads"
            disabled={leadsApi.loading}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </section>

      {leadsApi.loading ? <Loading label="Loading leads..." /> : null}
      {leadsApi.error ? (
        <ErrorMessage message={leadsApi.error} onRetry={() => void leadsApi.reload()} />
      ) : null}

      {!leadsApi.loading && !leadsApi.error && leads.length === 0 ? (
        <EmptyState
          icon="leads"
          title="No leads match these filters"
          description="Try clearing filters or connect a lead source to start filling the pipeline."
        />
      ) : null}

      {leads.length > 0 && view === "pipeline" ? (
        <div className="pipeline">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = grouped.get(stage.value) ?? [];
            const value = stageLeads.reduce((sum, lead) => sum + (lead.budget_max ?? 0), 0);
            return (
              <div
                key={stage.value}
                className={`pipeline-column ${dropTarget === stage.value ? "pipeline-column--over" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTarget(stage.value);
                }}
                onDragLeave={() => setDropTarget((current) => (current === stage.value ? null : current))}
                onDrop={(event) => onDrop(event, stage.value)}
              >
                <header className="pipeline-column__header">
                  <span className={`stage-dot stage-dot--${stage.tone}`} />
                  <strong>{stage.label}</strong>
                  <span className="pipeline-column__count">{stageLeads.length}</span>
                </header>
                <p className="pipeline-column__value">{value > 0 ? `${budgetRange(null, value)} potential` : "No value yet"}</p>
                <div className="pipeline-column__cards">
                  {stageLeads.map((lead) => {
                    const owner = agentMap.get(lead.assigned_agent_id ?? "");
                    return (
                      <article
                        key={lead.id}
                        className={`lead-card ${draggingId === lead.id ? "lead-card--dragging" : ""}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/lead-id", lead.id);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingId(lead.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropTarget(null);
                        }}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            navigate(`/leads/${lead.id}`);
                          }
                        }}
                      >
                        <div className="lead-card__top">
                          <span className="avatar avatar--sm">{initials(lead.name, lead.phone.slice(-2))}</span>
                          <div className="lead-card__identity">
                            <strong>{lead.name ?? "Unnamed lead"}</strong>
                            <small>{lead.phone}</small>
                          </div>
                          <ScoreBadge score={lead.qualification_score} />
                        </div>
                        <div className="lead-card__meta">
                          <span>
                            <Icon name="mapPin" size={13} /> {lead.preferred_city ?? "City not set"}
                          </span>
                          <span>{budgetRange(lead.budget_min, lead.budget_max)}</span>
                        </div>
                        <div className="lead-card__footer">
                          <Badge tone="neutral">{titleCase(lead.source)}</Badge>
                          {owner ? (
                            <span className="lead-card__owner">
                              <span className="avatar avatar--xs">{initials(owner.name)}</span>
                              {owner.name.split(" ")[0]}
                            </span>
                          ) : (
                            <span className="muted">Unassigned</span>
                          )}
                          <span className="muted">{formatRelativeTime(lead.created_at)}</span>
                        </div>
                      </article>
                    );
                  })}
                  {stageLeads.length === 0 ? (
                    <p className="pipeline-column__empty">Drop leads here</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {leads.length > 0 && view === "list" ? (
        <div className="card table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>City</th>
                  <th>Budget</th>
                  <th>Score</th>
                  <th>Owner</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const owner = agentMap.get(lead.assigned_agent_id ?? "");
                  return (
                    <tr key={lead.id} className="data-table__row" onClick={() => navigate(`/leads/${lead.id}`)}>
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
                      <td>{titleCase(lead.source)}</td>
                      <td>{text(lead.preferred_city)}</td>
                      <td>{formatMoney(lead.budget_max)}</td>
                      <td>
                        <ScoreBadge score={lead.qualification_score} />
                      </td>
                      <td>{owner?.name ?? "—"}</td>
                      <td>{formatRelativeTime(lead.created_at)}</td>
                      <td>
                        <Icon name="chevronRight" size={15} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer className="table-card__footer">
            <span>
              Showing {leads.length} of {leadsApi.data?.count ?? leads.length} leads
            </span>
            {stats.localChanges > 0 ? (
              <span className="muted">Local status changes are not synced yet.</span>
            ) : null}
          </footer>
        </div>
      ) : null}
    </div>
  );
}
