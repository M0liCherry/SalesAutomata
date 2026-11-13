import { useMemo, useState } from "react";

import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { ErrorMessage, Loading } from "../components/Status";
import { formatMoney, text } from "../format";
import { useApi } from "../hooks/useApi";
import { downloadCsv, titleCase, type Tone } from "../lib/constants";
import { useToast } from "../lib/toast";
import { navigate } from "../router";
import type { ListResponse, Project, Property } from "../types";
import "../styles/inventory.css";

type View = "grid" | "table";

interface Filters {
  search: string;
  city: string;
  property_type: string;
  listing_type: string;
  availability: string;
  min_price: string;
  max_price: string;
  bedrooms: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  city: "",
  property_type: "",
  listing_type: "",
  availability: "",
  min_price: "",
  max_price: "",
  bedrooms: "",
};

const PROPERTY_TYPES = [
  "apartment",
  "villa",
  "plot",
  "penthouse",
  "commercial_office",
  "retail_shop",
  "warehouse",
  "independent_house",
];

const LISTING_TYPES = ["sale", "rent"];
const AVAILABILITIES = ["available", "reserved", "sold", "rented"];

function availabilityTone(value: string): Tone {
  switch (value) {
    case "available":
      return "success";
    case "reserved":
      return "warning";
    case "sold":
      return "danger";
    case "rented":
      return "info";
    default:
      return "neutral";
  }
}

function listingTone(value: string): Tone {
  if (value === "sale") {
    return "accent";
  }
  if (value === "rent") {
    return "info";
  }
  return "neutral";
}

function propertyFacts(property: Property): string[] {
  return [
    property.bedrooms !== null ? `${property.bedrooms} bd` : null,
    property.bathrooms !== null ? `${property.bathrooms} ba` : null,
    property.area_sqft !== null ? `${property.area_sqft} sqft` : null,
  ].filter((value): value is string => value !== null);
}

function locationLabel(property: Property): string {
  return [property.city, property.locality].filter(Boolean).join(" · ") || "—";
}

export function PropertiesPage() {
  const { toast } = useToast();
  const [view, setView] = useState<View>("grid");
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const propertiesApi = useApi<ListResponse<Property>>("/api/properties", {
    search: applied.search,
    city: applied.city,
    property_type: applied.property_type,
    listing_type: applied.listing_type,
    availability: applied.availability,
    min_price: applied.min_price,
    max_price: applied.max_price,
    bedrooms: applied.bedrooms,
    limit: 100,
    order: "created_at.desc",
  });

  const projectsApi = useApi<ListResponse<Project>>("/api/projects", {
    limit: 200,
  });

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of projectsApi.data?.data ?? []) {
      map.set(project.id, project);
    }
    return map;
  }, [projectsApi.data]);

  const properties = useMemo(
    () => propertiesApi.data?.data ?? [],
    [propertiesApi.data],
  );

  const stats = useMemo(
    () => ({
      total: propertiesApi.data?.count ?? properties.length,
      available: properties.filter((item) => item.availability === "available").length,
      forSale: properties.filter((item) => item.listing_type === "sale").length,
      forRent: properties.filter((item) => item.listing_type === "rent").length,
    }),
    [propertiesApi.data, properties],
  );

  const projectName = (property: Property): string => {
    if (!property.project_id) {
      return "Standalone listing";
    }
    return projectMap.get(property.project_id)?.name ?? "Unlinked project";
  };

  const applyFilters = () => setApplied({ ...draft });

  const resetFilters = () => {
    setDraft({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
  };

  const copyListingLink = async (property: Property) => {
    const url = `${window.location.origin}/properties/${property.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Listing link copied to clipboard.", "success");
    } catch {
      toast(`Could not copy automatically. Link: ${url}`, "danger");
    }
  };

  const shareOnWhatsApp = (property: Property) => {
    toast(
      `WhatsApp share for "${property.title}" will be enabled when messaging is connected.`,
      "warning",
    );
  };

  const exportCsv = () => {
    downloadCsv(
      `properties-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Title",
        "Project",
        "Type",
        "Listing",
        "Price",
        "City",
        "Locality",
        "Bedrooms",
        "Bathrooms",
        "Area (sqft)",
        "Availability",
        "Features",
        "Created",
      ],
      properties.map((property) => [
        property.title,
        projectName(property),
        property.property_type,
        property.listing_type,
        property.price,
        property.city,
        property.locality ?? "",
        property.bedrooms ?? "",
        property.bathrooms ?? "",
        property.area_sqft ?? "",
        property.availability,
        property.features.join("; "),
        property.created_at,
      ]),
    );
    toast(`Exported ${properties.length} properties.`, "success");
  };

  return (
    <div className="stack">
      <PageHeader
        title="Properties"
        subtitle="Browse the inventory, match listings to leads and share details in a click."
        actions={
          <button
            type="button"
            className="button"
            onClick={exportCsv}
            disabled={properties.length === 0}
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
        <div className="stat-chip">
          <span>Available</span>
          <strong>{stats.available}</strong>
        </div>
        <div className="stat-chip">
          <span>For sale</span>
          <strong>{stats.forSale}</strong>
        </div>
        <div className="stat-chip">
          <span>For rent</span>
          <strong>{stats.forRent}</strong>
        </div>
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
            <span className="sr-only">Search properties</span>
            <span className="input-with-icon">
              <Icon name="search" size={15} />
              <input
                placeholder="Search title, city or locality"
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
            <span className="sr-only">Property type</span>
            <select
              value={draft.property_type}
              onChange={(event) => setDraft({ ...draft, property_type: event.target.value })}
            >
              <option value="">All types</option>
              {PROPERTY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Listing type</span>
            <select
              value={draft.listing_type}
              onChange={(event) => setDraft({ ...draft, listing_type: event.target.value })}
            >
              <option value="">All listings</option>
              {LISTING_TYPES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Availability</span>
            <select
              value={draft.availability}
              onChange={(event) => setDraft({ ...draft, availability: event.target.value })}
            >
              <option value="">Any availability</option>
              {AVAILABILITIES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline">
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              min={0}
              placeholder="Min price"
              value={draft.min_price}
              onChange={(event) => setDraft({ ...draft, min_price: event.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              min={0}
              placeholder="Max price"
              value={draft.max_price}
              onChange={(event) => setDraft({ ...draft, max_price: event.target.value })}
            />
          </label>
          <label className="field field--inline">
            <span className="sr-only">Bedrooms</span>
            <input
              type="number"
              min={0}
              placeholder="Bedrooms"
              value={draft.bedrooms}
              onChange={(event) => setDraft({ ...draft, bedrooms: event.target.value })}
            />
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
            onClick={() => void propertiesApi.reload()}
            aria-label="Refresh properties"
            disabled={propertiesApi.loading}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </section>

      {propertiesApi.loading ? <Loading label="Loading properties..." /> : null}
      {propertiesApi.error ? (
        <ErrorMessage
          message={propertiesApi.error}
          onRetry={() => void propertiesApi.reload()}
        />
      ) : null}

      {!propertiesApi.loading && !propertiesApi.error && properties.length === 0 ? (
        <EmptyState
          icon="property"
          title="No properties match these filters"
          description="Try widening your price range, changing the city or clearing the filters."
        />
      ) : null}

      {properties.length > 0 && view === "grid" ? (
        <div className="inv-grid">
          {properties.map((property) => {
            const facts = propertyFacts(property);
            return (
              <article key={property.id} className="inv-card">
                <div className="inv-card__head">
                  <div className="inv-card__title">
                    <strong>{property.title}</strong>
                    <small>{projectName(property)}</small>
                  </div>
                  <span className="inv-card__price">{formatMoney(property.price)}</span>
                </div>

                <div className="inv-card__badges">
                  <Badge tone="neutral">{titleCase(property.property_type)}</Badge>
                  <Badge tone={listingTone(property.listing_type)}>
                    {titleCase(property.listing_type)}
                  </Badge>
                  <Badge tone={availabilityTone(property.availability)} dot>
                    {titleCase(property.availability)}
                  </Badge>
                </div>

                <p className="inv-card__location">
                  <Icon name="mapPin" size={13} /> {locationLabel(property)}
                </p>

                {facts.length > 0 ? (
                  <div className="inv-card__facts">
                    {facts.map((fact) => (
                      <span key={fact}>{fact}</span>
                    ))}
                  </div>
                ) : null}

                {property.features.length > 0 ? (
                  <div className="inv-card__features">
                    {property.features.slice(0, 4).map((feature) => (
                      <span key={feature} className="inv-chip">
                        {feature}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="inv-card__footer">
                  <button
                    type="button"
                    className="button button--sm button--primary"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <Icon name="external" size={13} /> Open
                  </button>
                  <button
                    type="button"
                    className="button button--sm"
                    onClick={() => void copyListingLink(property)}
                  >
                    <Icon name="note" size={13} /> Copy link
                  </button>
                  <button
                    type="button"
                    className="button button--sm"
                    onClick={() => shareOnWhatsApp(property)}
                  >
                    <Icon name="whatsapp" size={13} /> WhatsApp
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {properties.length > 0 && view === "table" ? (
        <div className="card table-card">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Listing</th>
                  <th>Price</th>
                  <th>Location</th>
                  <th>Beds / baths</th>
                  <th>Area</th>
                  <th>Availability</th>
                  <th>Features</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr
                    key={property.id}
                    className="data-table__row"
                    onClick={() => navigate(`/properties/${property.id}`)}
                  >
                    <td>
                      <div className="inv-table-title">
                        <strong>{property.title}</strong>
                        <small>{projectName(property)}</small>
                      </div>
                    </td>
                    <td>{titleCase(property.property_type)}</td>
                    <td>
                      <Badge tone={listingTone(property.listing_type)}>
                        {titleCase(property.listing_type)}
                      </Badge>
                    </td>
                    <td>{formatMoney(property.price)}</td>
                    <td>{locationLabel(property)}</td>
                    <td>
                      {text(property.bedrooms)} / {text(property.bathrooms)}
                    </td>
                    <td>{property.area_sqft !== null ? `${property.area_sqft} sqft` : "—"}</td>
                    <td>
                      <Badge tone={availabilityTone(property.availability)} dot>
                        {titleCase(property.availability)}
                      </Badge>
                    </td>
                    <td>
                      <span className="inv-cell-wrap">
                        {property.features.length > 0
                          ? property.features.slice(0, 3).join(", ")
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <div className="inv-table-actions">
                        <button
                          type="button"
                          className="button button--sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            void copyListingLink(property);
                          }}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="button button--sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            shareOnWhatsApp(property);
                          }}
                        >
                          Share
                        </button>
                        <Icon name="chevronRight" size={15} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="table-card__footer">
            <span>
              Showing {properties.length} of {stats.total} properties
            </span>
            <span>Click a row to open the property detail.</span>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
