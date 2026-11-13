export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export interface StageConfig {
  value: string;
  label: string;
  tone: Tone;
}

export const LEAD_STAGES: StageConfig[] = [
  { value: "new", label: "New", tone: "info" },
  { value: "contacted", label: "Contacted", tone: "accent" },
  { value: "qualified", label: "Qualified", tone: "warning" },
  { value: "interested", label: "Interested", tone: "warning" },
  { value: "site_visit_scheduled", label: "Visit scheduled", tone: "accent" },
  { value: "negotiation", label: "Negotiation", tone: "warning" },
  { value: "won", label: "Won", tone: "success" },
  { value: "lost", label: "Lost", tone: "danger" },
  { value: "not_interested", label: "Not interested", tone: "danger" },
];

export const PIPELINE_STAGES = LEAD_STAGES.filter(
  (stage) => stage.value !== "not_interested",
);

export const LEAD_SOURCES = [
  "whatsapp",
  "website",
  "99acres",
  "magicbricks",
  "housing",
  "facebook",
  "instagram",
  "referral",
  "walk_in",
  "google_ads",
  "other",
];

export const CONVERSATION_STATUSES = ["open", "closed", "handed_off"];

export function titleCase(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function findStage(status: string | null | undefined): StageConfig {
  return (
    LEAD_STAGES.find((stage) => stage.value === status) ?? {
      value: status ?? "unknown",
      label: titleCase(status),
      tone: "neutral",
    }
  );
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) {
    return fallback;
  }
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || fallback;
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) {
    return "just now";
  }

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < hour) {
    return formatter.format(Math.round(diff / minute), "minute");
  }
  if (abs < day) {
    return formatter.format(Math.round(diff / hour), "hour");
  }
  if (abs < 7 * day) {
    return formatter.format(Math.round(diff / day), "day");
  }
  return date.toLocaleDateString();
}

export function formatDay(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatClockTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function isOverdue(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export function budgetRange(min: number | null, max: number | null): string {
  if (min === null && max === null) {
    return "Budget not set";
  }
  const compact = (value: number) => {
    if (value >= 10_000_000) {
      return `${(value / 10_000_000).toFixed(1).replace(/\.0$/, "")} Cr`;
    }
    if (value >= 100_000) {
      return `${(value / 100_000).toFixed(1).replace(/\.0$/, "")} L`;
    }
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  };
  if (min !== null && max !== null) {
    return `₹${compact(min)} – ₹${compact(max)}`;
  }
  return `₹${compact((min ?? max) as number)}`;
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<unknown>>,
): void {
  const content = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
