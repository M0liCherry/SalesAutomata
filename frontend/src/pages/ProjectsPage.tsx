import { useMemo, useState } from "react";

import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { ErrorMessage, Loading } from "../components/Status";
import { text } from "../format";
import { useApi } from "../hooks/useApi";
import { downloadCsv, titleCase, type Tone } from "../lib/constants";
import { useToast } from "../lib/toast";
import { navigate } from "../router";
import type { ListResponse, Project } from "../types";
import "../styles/inventory.css";

type View = "grid" | "table";

interface Filters {
  search: string;
  city: string;
  status: string;
  project_type: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  city: "",
  status: "",
  project_type: "",
};

const PROJECT_STATUSES = [
  "pre_launch",
  "launch",
  "under_construction",
  "ready",
  "completed",
];

const PROJECT_TYPES = ["residential", "commercial", "mixed"];

function statusTone(value: string): Tone {
  switch (value) {
    case "ready":
    case "completed":
      return "success";
    case "under_construction":
      return "warning";
    case "launch":
      return "accent";
    case "pre_launch":
      return "info";
    default:
      return "neutral";
  }
}

function locationLabel(project: Project): string {
  return [project.city, project.locality].filter(Boolean).join(" · ") || "—";
}

function descriptionSnippet(project: Project): string {
  const description = project.description?.trim();
  if (!description) {
    return "No description added yet.";
  }
  if (description.length <= 160) {
    return description;
  }
  return `${description.slice(0, 157)}…`;
}

export function ProjectsPage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("grid");
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const projectsApi = useApi<ListResponse<Project>>("/api/projects", {
    search: applied.search,
    city: applied.city,
    status: applied.status,
    project_type: applied.project_type,
    limit: 200,
    order: "created_at.desc",
  });

  const projects = useMemo(() => projectsApi.data?.data ?? [], [projectsApi.data]);

  const statusStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      counts.set(project.status, (counts.get(project.status) ?? 0) + 1);
    }
    const known = PROJECT_STATUSES.filter((value) => counts.has(value));
    const extra = [...counts.keys()].filter((value) => !PROJECT_STATUSES.includes(value));
    return [...known, ...extra].map((value) => ({
      value,
      label: titleCase(value),
      count: counts.get(value) ?? 0,
    }));
  }, [projects]);

  const stats = useMemo(
    () => ({
      total: projectsApi.data?.count ?? projects.length,
    }),
    [projectsApi.data, projects],
  );

  const applyFilters = () => setApplied({ ...draft });

  const resetFilters = () => {
    setDraft({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
  };

  const exportCsv = () => {
    downloadCsv(
      `projects-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Name",
        "Developer",
        "Type",
        "Status",
        "City",
        "Locality",
        "Possession",
        "Amenities",
        "Description",
        "Created",
      ],
      projects.map((project) => [
        project.name,
        project.developer ?? "",
        project.project_type,
        project.status,
        project.city,
        project.locality ?? "",
        project.possession_date ?? "",
        project.amenities.join("; "),
        project.description ?? "",
        project.created_at,
      ]),
    );
    toast(`Exported ${projects.length} projects.`, "success");
  };

  return (
    <div className="stack">
      <PageHeader
        title="Projects"
        subtitle="Developments that group inventory, amenities and possession timelines."
        actions={
          <button
            type="button"
            className="button"
            onClick={exportCsv}
            disabled={projects.length === 0}
          >
            <Icon name="download" size={15} /> Export CSV
          </button>
        }
      />

      <div className="stat-row">
        <div className="stat-chip">
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        {statusStats.map((stat) => (
          <div key={stat.value} className="stat-chip">
            <span>{stat.label}</span>
            <strong>{stat.count}</strong>
          </div>
        ))}
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
            <span className="sr-only">Search projects</span>
            <span className="input-with-icon">
              <Icon name="search" size={15} />
              <input
                placeholder="Search name, developer or city"
                value={draft.search}
                onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              />
            </span>
          </label>
          <label className="field field--inline">
            <span className="sr-only">City</span>
            <input
              placeholder="City"
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span className="sr-only">Status</span>
            <select
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
            >
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Project type</span>
            <select
              value={draft.project_type}
              onChange={(event) => setDraft({ ...draft, project_type: event.target.value })}
            >
              <option value="">All types</option>
              {PROJECT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
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
              className={
                view === "grid"
                  ? "segmented__item segmented__item--active"
                  : "segmented__item"
              }
              onClick={() => setView("grid")}
            >
              <Icon name="grid" size={14} /> Grid
            </button>
            <button
              type="button"
              className={
                view === "table"
                  ? "segmented__item segmented__item--active"
                  : "segmented__item"
              }
              onClick={() => setView("table")}
            >
              <Icon name="list" size={14} /> Table
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => void projectsApi.reload()}
            aria-label="Refresh projects"
            disabled={projectsApi.loading}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </section>

      {projectsApi.loading ? <Loading label="Loading projects..." /> : null}
      {projectsApi.error ? (
        <ErrorMessage
          message={projectsApi.error}
          onRetry={() => void projectsApi.reload()}
        />
      ) : null}

      {!projectsApi.loading && !projectsApi.error && projects.length === 0 ? (
        <EmptyState
          icon="project"
          title="No projects match these filters"
          description="Try a different city or status, or clear the filters to see the full portfolio."
        />
      ) : null}

      {projects.length > 0 && view === "grid" ? (
        <div className="inv-grid">
          {projects.map((project) => (
            <article key={project.id} className="inv-card">
              <div className="inv-card__head">
                <div className="inv-card__title">
                  <strong>{project.name}</strong>
                  <small>{text(project.developer)}</small>
                </div>
                <Badge tone={statusTone(project.status)} dot>
                  {titleCase(project.status)}
                </Badge>
              </div>

              <div className="inv-card__badges">
                <Badge tone="neutral">{titleCase(project.project_type)}</Badge>
                <span className="inv-chip">
                  {project.amenities.length} amenit
                  {project.amenities.length === 1 ? "y" : "ies"}
                </span>
              </div>

              <p className="inv-card__location">
                <Icon name="mapPin" size={13} /> {locationLabel(project)}
              </p>

              <div className="inv-card__facts">
                <span>
                  <Icon name="calendar" size={13} /> Possession:{" "}
                  {text(project.possession_date)}
                </span>
              </div>

              <p className="inv-card__description">{descriptionSnippet(project)}</p>

              <div className="inv-card__footer">
                <button
                  type="button"
                  className="button button--sm button--primary"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <Icon name="external" size={13} /> Open project
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {projects.length > 0 && view === "table" ? (
        <div className="card table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Developer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Possession</th>
                  <th>Amenities</th>
                  <th>Description</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className="data-table__row"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <td>
                      <div className="inv-table-title">
                        <strong>{project.name}</strong>
                        <small>{locationLabel(project)}</small>
                      </div>
                    </td>
                    <td>{text(project.developer)}</td>
                    <td>{titleCase(project.project_type)}</td>
                    <td>
                      <Badge tone={statusTone(project.status)} dot>
                        {titleCase(project.status)}
                      </Badge>
                    </td>
                    <td>{locationLabel(project)}</td>
                    <td>{text(project.possession_date)}</td>
                    <td>{project.amenities.length}</td>
                    <td>
                      <span className="inv-cell-wrap">{descriptionSnippet(project)}</span>
                    </td>
                    <td>
                      <Icon name="chevronRight" size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="table-card__footer">
            <span>
              Showing {projects.length} of {stats.total} projects
            </span>
            <span>Click a row to open the project detail.</span>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
