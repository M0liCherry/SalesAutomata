import { useEffect, useRef, useState } from "react";

import { useApi } from "../hooks/useApi";
import { formatRelativeTime, isOverdue, titleCase } from "../lib/constants";
import { navigate } from "../router";
import type { Appointment, DashboardSummary, FollowUp, ListResponse } from "../types";
import { Icon, type IconName } from "./Icon";

interface NotificationItem {
  id: string;
  icon: IconName;
  title: string;
  meta: string;
  path: string;
  alert?: boolean;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const summary = useApi<DashboardSummary>("/api/dashboard/summary");
  const followUps = useApi<ListResponse<FollowUp>>("/api/follow-ups", {
    status: "pending",
    limit: 5,
    order: "due_at.asc",
  });
  const appointments = useApi<ListResponse<Appointment>>("/api/appointments", {
    upcoming: "true",
    limit: 5,
    order: "scheduled_at.asc",
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const items: NotificationItem[] = [];

  for (const item of followUps.data?.data ?? []) {
    items.push({
      id: `follow-up-${item.id}`,
      icon: "followup",
      title: item.note ?? "Follow-up due",
      meta: `${titleCase(item.channel)} · ${formatRelativeTime(item.due_at)}`,
      path: `/leads/${item.lead_id}`,
      alert: isOverdue(item.due_at),
    });
  }

  for (const item of appointments.data?.data ?? []) {
    items.push({
      id: `appointment-${item.id}`,
      icon: "calendar",
      title: `${titleCase(item.appointment_type)} appointment`,
      meta: formatRelativeTime(item.scheduled_at),
      path: `/leads/${item.lead_id}`,
    });
  }

  const openConversations = summary.data?.conversations.open ?? 0;
  if (openConversations > 0) {
    items.push({
      id: "open-conversations",
      icon: "inbox",
      title: `${openConversations} open conversation${openConversations === 1 ? "" : "s"}`,
      meta: "Needs a reply",
      path: "/inbox",
    });
  }

  const badgeCount = items.length;

  return (
    <div className="popover" ref={ref}>
      <button
        type="button"
        className="icon-button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="bell" />
        {badgeCount > 0 ? <span className="icon-button__badge">{badgeCount}</span> : null}
      </button>
      {open ? (
        <div className="popover__panel popover__panel--wide">
          <header className="popover__header">
            <h3>Needs attention</h3>
            <span className="muted">{badgeCount} items</span>
          </header>
          <div className="popover__list">
            {items.length === 0 ? (
              <p className="popover__empty">You are all caught up.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`popover__item ${item.alert ? "popover__item--alert" : ""}`}
                  onClick={() => {
                    navigate(item.path);
                    setOpen(false);
                  }}
                >
                  <span className="popover__icon">
                    <Icon name={item.icon} size={16} />
                  </span>
                  <span className="popover__text">
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                  </span>
                  <Icon name="chevronRight" size={14} />
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
