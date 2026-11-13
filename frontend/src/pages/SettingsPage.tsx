import { useState } from "react";

import { Badge } from "../components/Badge";
import { Icon } from "../components/Icon";
import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";

const SECTIONS = [
  { id: "workspace", label: "Workspace", icon: "settings" },
  { id: "whatsapp", label: "WhatsApp", icon: "whatsapp" },
  { id: "automation", label: "Automation", icon: "sparkles" },
  { id: "team", label: "Team", icon: "agents" },
  { id: "billing", label: "Billing & usage", icon: "activity" },
] as const;

export function SettingsPage() {
  const { configured, user, demo } = useAuth();
  const { toast } = useToast();
  const [active, setActive] = useState<(typeof SECTIONS)[number]["id"]>("workspace");
  const [workspaceName, setWorkspaceName] = useState("SalesAutomata Realty");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");

  const save = () => toast("Saved locally. Workspace settings API is pending.", "success");

  return (
    <div className="stack">
      <PageHeader
        title="Settings"
        subtitle="Workspace, channels, automation and usage controls."
      />

      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`settings-nav__item ${active === section.id ? "settings-nav__item--active" : ""}`}
              onClick={() => setActive(section.id)}
            >
              <Icon name={section.icon} size={16} />
              {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-body">
          {active === "workspace" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Workspace profile</h2>
                  <p>Used across dashboards, reports and exported documents.</p>
                </div>
              </header>
              <div className="form-grid">
                <label className="field">
                  <span>Workspace name</span>
                  <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
                </label>
                <label className="field">
                  <span>Timezone</span>
                  <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">America/New_York</option>
                  </select>
                </label>
                <label className="field">
                  <span>Currency</span>
                  <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                    <option value="INR">Indian Rupee (₹)</option>
                    <option value="AED">UAE Dirham</option>
                    <option value="USD">US Dollar</option>
                  </select>
                </label>
                <label className="field">
                  <span>Business hours</span>
                  <input defaultValue="Mon–Sat, 9:00–19:00" />
                </label>
              </div>
              <footer className="card__footer">
                <button type="button" className="button button--primary" onClick={save}>
                  Save changes
                </button>
              </footer>
            </section>
          ) : null}

          {active === "whatsapp" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>WhatsApp Business</h2>
                  <p>Connection health and messaging limits for the workspace number.</p>
                </div>
                <Badge tone="warning" dot>
                  Not connected
                </Badge>
              </header>
              <div className="settings-list">
                <div className="settings-row">
                  <div>
                    <strong>Business number</strong>
                    <small>Connect a WhatsApp Cloud API number to receive leads.</small>
                  </div>
                  <button type="button" className="button" onClick={() => toast("WhatsApp connection API is pending.", "warning")}>
                    Connect number
                  </button>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Quality rating</strong>
                    <small>Green / yellow / red status reported by Meta.</small>
                  </div>
                  <span className="muted">—</span>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Messaging limit</strong>
                    <small>Daily conversation capacity for the connected number.</small>
                  </div>
                  <span className="muted">—</span>
                </div>
              </div>
            </section>
          ) : null}

          {active === "automation" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Automation (n8n)</h2>
                  <p>Monitor workflow health and AI handoff behaviour.</p>
                </div>
                <Badge tone="warning" dot>
                  Waiting for webhook
                </Badge>
              </header>
              <div className="settings-list">
                <div className="settings-row">
                  <div>
                    <strong>Webhook endpoint</strong>
                    <small>n8n posts qualification, message and handoff events here.</small>
                  </div>
                  <code className="code-pill">/api/webhooks/n8n</code>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>AI handoff threshold</strong>
                    <small>Hand off to a human when the lead asks for a person or after repeated failures.</small>
                  </div>
                  <input className="input input--short" type="number" defaultValue={3} />
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Default tone</strong>
                    <small>Used by qualification and follow-up workflows.</small>
                  </div>
                  <select className="input input--short" defaultValue="consultative">
                    <option value="consultative">Consultative</option>
                    <option value="concise">Concise</option>
                    <option value="friendly">Friendly</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Workflow runs</strong>
                    <small>Run history, retries and failures will appear here.</small>
                  </div>
                  <button type="button" className="button" onClick={() => toast("Automation run API is pending.", "warning")}>
                    View runs
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {active === "team" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Team & access</h2>
                  <p>Invite sales agents and control what they can see.</p>
                </div>
                <button type="button" className="button button--primary" onClick={() => toast("Invite API is pending.", "warning")}>
                  <Icon name="plus" size={15} /> Invite agent
                </button>
              </header>
              <div className="settings-list">
                <div className="settings-row">
                  <div>
                    <strong>{user?.email ?? (demo ? "Demo workspace owner" : "Current user")}</strong>
                    <small>Owner · full access</small>
                  </div>
                  <Badge tone="success">Active</Badge>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>Authentication</strong>
                    <small>{configured ? "Supabase Auth connected" : "Supabase Auth not configured"}</small>
                  </div>
                  <Badge tone={configured ? "success" : "warning"} dot>
                    {configured ? "Connected" : "Demo mode"}
                  </Badge>
                </div>
              </div>
            </section>
          ) : null}

          {active === "billing" ? (
            <section className="card">
              <header className="card__header">
                <div>
                  <h2>Billing & usage</h2>
                  <p>Subscription, seats and conversation usage.</p>
                </div>
                <Badge tone="info">Trial</Badge>
              </header>
              <div className="usage-grid">
                <div className="usage-card">
                  <span>Plan</span>
                  <strong>Growth (trial)</strong>
                  <small>14 days remaining</small>
                </div>
                <div className="usage-card">
                  <span>Agents</span>
                  <strong>1 of 5</strong>
                  <small>Seats in use</small>
                </div>
                <div className="usage-card">
                  <span>Conversations</span>
                  <strong>0 of 1,000</strong>
                  <small>This billing cycle</small>
                </div>
              </div>
              <footer className="card__footer">
                <button type="button" className="button" onClick={() => toast("Billing portal is pending.", "warning")}>
                  Manage subscription
                </button>
              </footer>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
