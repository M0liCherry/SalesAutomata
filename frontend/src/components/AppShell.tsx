import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useAuth } from "../lib/auth";
import { initials, titleCase } from "../lib/constants";
import { useToast } from "../lib/toast";
import { Link, navigate, useRoute } from "../router";
import { CommandPalette } from "./CommandPalette";
import { Icon, type IconName } from "./Icon";
import { NotificationsMenu } from "./NotificationsMenu";

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { path: "/", label: "Dashboard", icon: "dashboard" },
      { path: "/analytics", label: "Analytics", icon: "activity" },
      { path: "/inbox", label: "Inbox", icon: "inbox" },
      { path: "/leads", label: "Leads", icon: "leads" },
      { path: "/appointments", label: "Appointments", icon: "calendar" },
      { path: "/follow-ups", label: "Follow-ups", icon: "followup" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { path: "/properties", label: "Properties", icon: "property" },
      { path: "/projects", label: "Projects", icon: "project" },
    ],
  },
  {
    label: "Team & content",
    items: [
      { path: "/agents", label: "Agents", icon: "agents" },
      { path: "/message-templates", label: "Templates", icon: "template" },
    ],
  },
  {
    label: "Data",
    items: [
      { path: "/interested-leads", label: "Interested leads", icon: "sparkles" },
      { path: "/activities", label: "Activity log", icon: "list" },
      { path: "/messages", label: "Message log", icon: "message" },
    ],
  },
];

function isActive(path: string, route: string): boolean {
  if (path === "/") {
    return route === "/";
  }
  return route === path || route.startsWith(`${path}/`);
}

function pageTitle(route: string): string {
  const match = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => item.path !== "/" && isActive(item.path, route))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (match) {
    return match.label;
  }
  const segment = route.split("/").filter(Boolean)[0];
  return segment ? titleCase(segment) : "Dashboard";
}

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const { demo, user, signOut } = useAuth();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const email = user?.email ?? (demo ? "demo@salesautomata.local" : "Signed in");
  const displayName = useMemo(() => {
    if (demo) {
      return "Demo workspace";
    }
    const local = email.split("@")[0] ?? email;
    return titleCase(local.replace(/[._-]+/g, " "));
  }, [demo, email]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [route]);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }
    const onClick = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast("Signed out.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not sign out.", "danger");
    }
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <span className="brand-mark">
            <Icon name="whatsapp" size={20} />
          </span>
          <span className="sidebar__brand-text">
            <strong>SalesAutomata</strong>
            <small>WhatsApp sales desk</small>
          </span>
          <button
            type="button"
            className="icon-button sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="x" />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group__label">{group.label}</p>
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-item ${isActive(item.path, route) ? "nav-item--active" : ""}`}
                >
                  <Icon name={item.icon} size={17} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <Link
            to="/settings"
            className={`nav-item ${isActive("/settings", route) ? "nav-item--active" : ""}`}
          >
            <Icon name="settings" size={16} />
            <span>Settings</span>
          </Link>
          <div className="workspace-card">
            <span className="avatar avatar--sm">{initials(displayName, "S")}</span>
            <div>
              <strong>{demo ? "Demo workspace" : "Sales workspace"}</strong>
              <small>{demo ? "Auth not configured" : "Single-company deployment"}</small>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              type="button"
              className="icon-button topbar__menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <div className="topbar__crumb">
              <span>Workspace</span>
              <Icon name="chevronRight" size={13} />
              <strong>{pageTitle(route)}</strong>
            </div>
          </div>

          <div className="topbar__right">
            <button
              type="button"
              className="search-trigger"
              onClick={() => setPaletteOpen(true)}
            >
              <Icon name="search" size={16} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <NotificationsMenu />
            <div className="popover" ref={userMenuRef}>
              <button
                type="button"
                className="user-chip"
                onClick={() => setUserMenuOpen((current) => !current)}
                aria-expanded={userMenuOpen}
              >
                <span className="avatar avatar--sm">{initials(displayName, "U")}</span>
                <span className="user-chip__text">
                  <strong>{displayName}</strong>
                  <small>{email}</small>
                </span>
                <Icon name="chevronDown" size={14} />
              </button>
              {userMenuOpen ? (
                <div className="popover__panel">
                  <div className="popover__identity">
                    <strong>{displayName}</strong>
                    <small>{email}</small>
                  </div>
                  <button type="button" className="popover__action" onClick={() => navigate("/settings")}>
                    <Icon name="settings" size={15} /> Settings
                  </button>
                  {demo ? (
                    <p className="popover__note">
                      Supabase Auth is not configured. Add the env vars to enable sign-in.
                    </p>
                  ) : (
                    <button type="button" className="popover__action" onClick={() => void handleSignOut()}>
                      <Icon name="logout" size={15} /> Sign out
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {demo ? (
          <div className="demo-banner">
            <Icon name="alert" size={15} />
            <span>
              Demo mode — Supabase Auth is not configured. Add <code>VITE_SUPABASE_URL</code> and{" "}
              <code>VITE_SUPABASE_ANON_KEY</code> to enable the login gate.
            </span>
          </div>
        ) : null}

        <main className="app-content">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
