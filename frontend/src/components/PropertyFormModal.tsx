import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

import { apiPatch, apiPost } from "../api";
import { useApi } from "../hooks/useApi";
import { Modal } from "./Modal";
import type { ListResponse, Project, Property } from "../types";

const propertyTypes = [
  "apartment",
  "villa",
  "plot",
  "penthouse",
  "commercial_office",
  "retail_shop",
  "warehouse",
  "independent_house",
];
const listingTypes = ["sale", "rent"];
const furnishings = ["", "unfurnished", "semi_furnished", "furnished"];
const availabilityOptions = ["available", "reserved", "sold", "rented"];
const propertyStatuses = ["active", "inactive"];

interface PropertyFormProps {
  initial: Property | null;
  onClose: () => void;
  onSaved: (saved: Property) => void;
}

const toForm = (p: Property | null) => ({
  title: p?.title ?? "",
  property_type: p?.property_type ?? "apartment",
  listing_type: p?.listing_type ?? "sale",
  price: p?.price != null ? String(p.price) : "",
  price_per_sqft: p?.price_per_sqft != null ? String(p.price_per_sqft) : "",
  bedrooms: p?.bedrooms != null ? String(p.bedrooms) : "",
  bathrooms: p?.bathrooms != null ? String(p.bathrooms) : "",
  balconies: p?.balconies != null ? String(p.balconies) : "",
  area_sqft: p?.area_sqft != null ? String(p.area_sqft) : "",
  floor: p?.floor != null ? String(p.floor) : "",
  total_floors: p?.total_floors != null ? String(p.total_floors) : "",
  furnishing: p?.furnishing ?? "",
  facing: p?.facing ?? "",
  parking: p?.parking != null ? String(p.parking) : "",
  availability: p?.availability ?? "available",
  status: p?.status ?? "active",
  project_id: p?.project_id ?? "",
  city: p?.city ?? "",
  locality: p?.locality ?? "",
  address: p?.address ?? "",
  description: p?.description ?? "",
  features: (p?.features ?? []).join(", "),
});

const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
export function PropertyFormModal({ initial, onClose, onSaved }: PropertyFormProps) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(() => toForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const projectsApi = useApi<ListResponse<Project>>("/api/projects", { limit: 200 });

  const set =
    (key: keyof ReturnType<typeof toForm>) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const field = (
    label: string,
    key: keyof ReturnType<typeof toForm>,
    props?: Partial<React.InputHTMLAttributes<HTMLInputElement>> & { placeholder?: string },
  ) => (
    <label className="field">
      <span>{label}</span>
      <input value={form[key]} onChange={set(key)} {...props} />
    </label>
  );

  const selectField = (
    label: string,
    key: keyof ReturnType<typeof toForm>,
    optionsList: string[],
    style?: CSSProperties,
  ) => (
    <label className="field" style={style}>
      <span>{label}</span>
      <select value={form[key]} onChange={set(key)}>
        {optionsList.map((option) => (
          <option key={option || "none"} value={option}>
            {option ? option.replaceAll("_", " ") : "—"}
          </option>
        ))}
      </select>
    </label>
  );

  const projectOptions = useMemo(
    () => (projectsApi.data?.data ?? []).map((project) => ({ value: project.id, label: project.name })),
    [projectsApi.data],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const numberOrUndefined = (value: string) => {
      if (value.trim() === "") return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const stringOrUndefined = (value: string) => {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : trimmed;
    };

    const payload: Record<string, unknown> = {};
    if (form.title.trim()) payload.title = form.title.trim();
    payload.property_type = form.property_type;
    payload.listing_type = form.listing_type;
    payload.price = numberOrUndefined(form.price);
    payload.price_per_sqft = numberOrUndefined(form.price_per_sqft);
    payload.bedrooms = numberOrUndefined(form.bedrooms);
    payload.bathrooms = numberOrUndefined(form.bathrooms);
    payload.balconies = numberOrUndefined(form.balconies);
    payload.area_sqft = numberOrUndefined(form.area_sqft);
    payload.floor = numberOrUndefined(form.floor);
    payload.total_floors = numberOrUndefined(form.total_floors);
    if (form.furnishing) payload.furnishing = form.furnishing;
    payload.facing = stringOrUndefined(form.facing);
    payload.parking = numberOrUndefined(form.parking);
    payload.availability = form.availability;
    payload.status = form.status;
    payload.project_id = form.project_id || null;
    payload.city = stringOrUndefined(form.city);
    payload.locality = stringOrUndefined(form.locality);
    payload.address = stringOrUndefined(form.address);
    payload.description = stringOrUndefined(form.description);
    const features = form.features.split(",").map((part) => part.trim()).filter(Boolean);
    payload.features = features;

    if (!payload.title) {
      setError("Title is required.");
      return;
    }
    if (isEdit ? false : payload.price === undefined) {
      setError("Price is required.");
      return;
    }
    if (!payload.city && !isEdit) {
      setError("City is required.");
      return;
    }

    setSubmitting(true);
    try {
      const saved = isEdit
        ? await apiPatch<Property>(`/api/properties/${initial!.id}`, payload)
        : await apiPost<Property>("/api/properties", payload);
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? "Edit property" : "Add property"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="property-form"
            className="button button--primary"
            disabled={submitting}
          >
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Add property"}
          </button>
        </>
      }
    >
      <form id="property-form" className="form-stack" onSubmit={(event) => void onSubmit(event)}>
        {field("Title", "title", { required: true, placeholder: "Skyline Residences 2BHK" })}
        <div style={gridStyle}>
          {selectField("Type", "property_type", propertyTypes)}
          {selectField("Listing", "listing_type", listingTypes)}
          {field("Price (INR)", "price", { type: "number", min: 0, required: !isEdit })}
          {field("Price / sqft", "price_per_sqft", { type: "number", min: 0 })}
          {field("Bedrooms", "bedrooms", { type: "number", min: 0 })}
          {field("Bathrooms", "bathrooms", { type: "number", min: 0 })}
          {field("Balconies", "balconies", { type: "number", min: 0 })}
          {field("Area (sqft)", "area_sqft", { type: "number", min: 0 })}
          {field("Floor", "floor", { type: "number" })}
          {field("Total floors", "total_floors", { type: "number", min: 1 })}
          {selectField("Furnishing", "furnishing", furnishings)}
          {field("Facing", "facing", { placeholder: "East / North-West..." })}
          {field("Parking", "parking", { type: "number", min: 0 })}
          {selectField("Availability", "availability", availabilityOptions)}
          {selectField("Status", "status", propertyStatuses)}
          <label className="field">
            <span>Project</span>
            <select value={form.project_id} onChange={set("project_id")}>
              <option value="">No project</option>
              {projectOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {field("City", "city", { required: !isEdit, placeholder: "Mumbai" })}
          {field("Locality", "locality", { placeholder: "Powai" })}
        </div>
        {field("Address", "address")}
        <label className="field">
          <span>Description</span>
          <textarea value={form.description} onChange={set("description")} rows={3} />
        </label>
        {field("Features (comma separated)", "features", { placeholder: "modular kitchen, lake view" })}
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </Modal>
  );
}
