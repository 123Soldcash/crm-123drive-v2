import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import MapView from "./pages/MapView";
import ActivityTracking from "./pages/ActivityTracking";
import ImportProperties from "./pages/ImportProperties";
import AgentPerformance from "./pages/AgentPerformance";
import UserManagement from "./pages/UserManagement";
import Buyers from "./pages/Buyers";
import BuyerDetail from "./pages/BuyerDetail";
import { TasksKanban } from "./pages/TasksKanban";
import { TasksList } from "./pages/TasksList";
import { TasksCalendar } from "./pages/TasksCalendar";
import BulkAgentAssignment from "./pages/BulkAgentAssignment";
import ImportDealMachine from "./pages/ImportDealMachine";
import { DuplicatesDashboard } from "./pages/DuplicatesDashboard";
import PipelineKanban from "./pages/PipelineKanban";
import InviteAccept from "./pages/InviteAccept";

// Named wrapper components to prevent React from unmounting/remounting
// on every render (inline arrow functions create new references each time)
function DashboardPage() {
  return <DashboardLayout><Dashboard /></DashboardLayout>;
}
function PropertiesPage() {
  return <DashboardLayout><Properties /></DashboardLayout>;
}
function PropertyDetailPage() {
  return <DashboardLayout><PropertyDetail /></DashboardLayout>;
}
function MapViewPage() {
  return <DashboardLayout><MapView /></DashboardLayout>;
}
function ActivityTrackingPage() {
  return <DashboardLayout><ActivityTracking /></DashboardLayout>;
}
function ImportPropertiesPage() {
  return <DashboardLayout><ImportProperties /></DashboardLayout>;
}
function AgentPerformancePage() {
  return <DashboardLayout><AgentPerformance /></DashboardLayout>;
}
function UserManagementPage() {
  return <DashboardLayout><UserManagement /></DashboardLayout>;
}
function BuyersPage() {
  return <DashboardLayout><Buyers /></DashboardLayout>;
}
function BuyerDetailPage() {
  return <DashboardLayout><BuyerDetail /></DashboardLayout>;
}
function TasksKanbanPage() {
  return <DashboardLayout><TasksKanban /></DashboardLayout>;
}
function TasksListPage() {
  return <DashboardLayout><TasksList /></DashboardLayout>;
}
function TasksCalendarPage() {
  return <DashboardLayout><TasksCalendar /></DashboardLayout>;
}
function BulkAgentAssignmentPage() {
  return <DashboardLayout><BulkAgentAssignment /></DashboardLayout>;
}
function ImportDealMachinePage() {
  return <DashboardLayout><ImportDealMachine /></DashboardLayout>;
}
function DuplicatesDashboardPage() {
  return <DashboardLayout><DuplicatesDashboard /></DashboardLayout>;
}
function PipelineKanbanPage() {
  return <DashboardLayout><PipelineKanban /></DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/properties" component={PropertiesPage} />
      <Route path="/properties/:id" component={PropertyDetailPage} />
      <Route path="/map" component={MapViewPage} />
      <Route path="/activity" component={ActivityTrackingPage} />
      <Route path="/import" component={ImportPropertiesPage} />
      <Route path="/agent-performance" component={AgentPerformancePage} />
      <Route path="/users" component={UserManagementPage} />
      <Route path="/buyers" component={BuyersPage} />
      <Route path="/buyers/:id" component={BuyerDetailPage} />
      <Route path="/agents" component={UserManagementPage} />
      <Route path="/agent-management" component={UserManagementPage} />
      <Route path="/bulk-assign-agents" component={BulkAgentAssignmentPage} />
      <Route path="/import-dealmachine" component={ImportDealMachinePage} />
      <Route path="/tasks/kanban" component={TasksKanbanPage} />
      <Route path="/tasks/list" component={TasksListPage} />
      <Route path="/tasks/calendar" component={TasksCalendarPage} />
      <Route path="/duplicates" component={DuplicatesDashboardPage} />
      <Route path="/pipeline" component={PipelineKanbanPage} />
      <Route path="/invite/:token" component={InviteAccept} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
