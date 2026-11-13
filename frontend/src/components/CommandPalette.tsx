import { useEffect, useMemo, useRef, useState } from "react";

import { apiGet } from "../api";
import { initials, titleCase } from "../lib/constants";
import { navigate } from "../router";
import type { Lead, ListResponse } from "../types";
import { Icon, type IconName } from "./Icon";

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  path: string;
}

const PAGE_ITEMS: PaletteItem[] = [
  { id: "page-dashboard", label: "Dashboard", icon: "dashboard", path: "/" },
  { id: "page-inbox", label: "Inbox", icon: "inbox", path: "/inbox" },
  { id: "page-leads", label: "Leads", icon: "leads", path: "/leads" },
  { id: "page-appointments", label: "Appointments", icon: "calendar", path: "/appointments" },
  { id: "page-followups", label: "Follow-ups", icon: "followup", path: "/follow-ups" },
  { id: "page-properties", label: "Properties", icon: "property", path: "/properties" },
  { id: "page-projects", label: "Projects", icon: "project", path: "/projects" },
  { id: "page-agents", label: "Agents", icon: "agents", path: "/agents" },
  { id: "page-templates", label: "Templates", icon: "template", path: "/message-templates" },
  { id: "page-activities", label: "Activity log", icon: "activity", path: "/activities" },
  { id: "page-analytics", label: "Analytics", icon: "grid", path: "/analytics" },
  { id: "page-settings", label: "Settings", icon: "settings", path: "/settings" },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || leads.length > 0) {
      return;
    }
    let active = true;
    apiGet<ListResponse<Lead>>("/api/leads", { limit: 200, order: "created_at.desc" })
      .then((response) => {
        if (active) {
          setLeads(response.data);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, leads.length]);

  const items = useMemo<PaletteItem[]>(() => {
    const term = query.trim().toLowerCase();
    const pages = PAGE_ITEMS.filter((item) => !term || item.label.toLowerCase().includes(term));
    if (!term) {
      return pages;
    }
    const leadItems = leads
      .filter((lead) => {
        const haystack = `${lead.name ?? ""} ${lead.phone} ${lead.email ?? ""} ${lead.status}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 6)
      .map<PaletteItem>((lead) => ({
        id: `lead-${lead.id}`,
        label: lead.name ?? lead.phone,
        hint: `${lead.phone} · ${titleCase(lead.status)}`,
        icon: "leads",
        path: `/leads/${lead.id}`,
      }));
    return [...pages, ...leadItems];
  }, [query, leads]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "Enter" && items[0]) {
        navigate(items[0].path);
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, items, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search workspace"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="palette__input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search leads, pages, actions..."
            aria-label="Search workspace"
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette__results">
          {items.length === 0 ? (
            <p className="palette__empty">No matches found.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="palette__item"
                onClick={() => {
                  navigate(item.path);
                  onClose();
                }}
              >
                <span className="palette__item-icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="palette__item-label">{item.label}</span>
                {item.hint ? <span className="palette__item-hint">{item.hint}</span> : null}
                <span className="avatar avatar--xs">{initials(item.label)}</span>
              </button>
            ))
          )}
        </div>
        <footer className="palette__footer">
          <span>
            <kbd>enter</kbd> open first result
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </footer>
      </div>
    </div>
  );
}
