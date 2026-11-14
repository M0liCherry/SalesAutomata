import { useState, type CSSProperties, type FormEvent } from "react";

import { apiPatch, apiPost } from "../api";
import { Modal } from "./Modal";
import type { Project } from "../types";

const projectTypes = ["residential", "commercial", "mixed"];
const projectStatuses = ["pre_launch", "launch", "under_construction", "ready", "completed"];

const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };

interface ProjectFormProps {
  initial: Project | null;
  onClose: () => void;
  onSaved: (saved: Project) => void;
}

const toForm = (p: Project | null) => ({
  name: p?.name ?? "",
  developer: p?.developer ?? "",
  project_type: p?.project_type ?? "residential",
  status: p?.status ?? "under_construction",
  city: p?.city ?? "",
  locality: p?.locality ?? "",
  address: p?.address ?? "",
  possession_date: p?.possession_date ? p.possession_date.slice(0, 10) : "",
  amenities: (p?.amenities ?? []).join(", "),
  description: p?.description ?? "",
});

export function ProjectFormModal({ initial, onClose, onSaved }: ProjectFormProps) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(() => toForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set =
    (key: keyof ReturnType<typeof toForm>) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const field = (
    label: string,
    key: keyof ReturnType<typeof toForm>,
    props?: Partial<React.InputHTMLAttributes<HTMLInputElement>>,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input value={form[key]} onChange={set(key)} {...props} />
    </label>
  );

  const selectField = (label: string, key: keyof ReturnType<typeof toForm>, optionsList: string[]) => (
    <label className="field">
      <span>{label}</span>
      <select value={form[key]} onChange={set(key)}>
        {optionsList.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );

  const stringOrUndefined = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload: Record<string, unknown> = {};
    payload.name = form.name.trim() || undefined;
    payload.project_type = form.project_type;
    payload.status = form.status;
    payload.developer = stringOrUndefined(form.developer);
    payload.city = stringOrUndefined(form.city);
    payload.locality = stringOrUndefined(form.locality);
    payload.address = stringOrUndefined(form.address);
    payload.possession_date = stringOrUndefined(form.possession_date);
    payload.description = stringOrUndefined(form.description);
    payload.amenities = form.amenities
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (!payload.name) {
      setError("Name is required.");
      return;
    }
    if (!payload.city) {
      setError("City is required.");
      return;
    }

    setSubmitting(true);
    try {
      const saved = isEdit
        ? await apiPatch<Project>(`/api/projects/${initial!.id}`, payload)
        : await apiPost<Project>("/api/projects", payload);
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? "Edit project" : "Add project"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="project-form"
            className="button button--primary"
            disabled={submitting}
          >
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Add project"}
          </button>
        </>
      }
    >
      <form id="project-form" className="form-stack" onSubmit={(event) => void onSubmit(event)}>
        {field("Name", "name", { required: true, placeholder: "Skyline Residences" })}
        <div style={gridStyle}>
          {field("Developer", "developer", { placeholder: "Meridian Builders" })}
          {selectField("Type", "project_type", projectTypes)}
          {selectField("Status", "status", projectStatuses)}
          {field("City", "city", { required: true, placeholder: "Mumbai" })}
          {field("Locality", "locality", { placeholder: "Powai" })}
          {field("Possession date", "possession_date", { type: "date" })}
        </div>
        {field("Address", "address")}
        <label className="field">
          <span>Amenities (comma separated)</span>
          <input
            value={form.amenities}
            onChange={set("amenities")}
            placeholder="gym, swimming pool, clubhouse"
          />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea value={form.description} onChange={set("description")} rows={3} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
      </form>
    </Modal>
  );
}
