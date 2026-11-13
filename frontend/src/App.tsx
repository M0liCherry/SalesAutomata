import { AppShell } from "./components/AppShell";
import { useAuth } from "./lib/auth";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { DashboardPage } from "./pages/DashboardPage";
import {
  AgentDetailPage,
  ProjectDetailPage,
  PropertyDetailPage,
} from "./pages/details";
import { FollowUpsPage } from "./pages/FollowUpsPage";
import { InboxPage } from "./pages/InboxPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { LeadsPage } from "./pages/LeadsPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { LoginPage } from "./pages/LoginPage";
import {
  ActivitiesPage,
  AgentsPage,
  InterestedLeadsPage,
  MessagesPage,
  TemplatesPage,
} from "./pages/lists";
import { SettingsPage } from "./pages/SettingsPage";
import { useRoute } from "./router";

function renderRoute(route: string) {
  const [resource, id] = route.split("/").filter(Boolean);

  switch (resource) {
    case undefined:
      return <DashboardPage />;
    case "analytics":
      return <AnalyticsPage />;
    case "inbox":
      return <InboxPage id={id} />;
    case "conversations":
      return <InboxPage id={id} />;
    case "leads":
      return id ? <LeadDetailPage id={id} /> : <LeadsPage />;
    case "properties":
      return id ? <PropertyDetailPage id={id} /> : <PropertiesPage />;
    case "projects":
      return id ? <ProjectDetailPage id={id} /> : <ProjectsPage />;
    case "agents":
      return id ? <AgentDetailPage id={id} /> : <AgentsPage />;
    case "messages":
      return <MessagesPage />;
    case "appointments":
      return <AppointmentsPage />;
    case "follow-ups":
      return <FollowUpsPage />;
    case "activities":
      return <ActivitiesPage />;
    case "interested-leads":
      return <InterestedLeadsPage />;
    case "message-templates":
      return <TemplatesPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return (
        <div className="card">
          <h2>Page not found</h2>
          <p className="muted">Unknown route: {route}</p>
        </div>
      );
  }
}

export default function App() {
  const route = useRoute();
  const { loading, session, demo } = useAuth();

  if (loading) {
    return (
      <div className="boot-screen">
        <span className="brand-mark brand-mark--lg">S</span>
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (!demo && !session) {
    return <LoginPage />;
  }

  return <AppShell>{renderRoute(route)}</AppShell>;
}
