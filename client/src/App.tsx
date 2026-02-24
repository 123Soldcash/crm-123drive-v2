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

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/properties" component={() => <DashboardLayout><Properties /></DashboardLayout>} />
      <Route path="/properties/:id" component={() => <DashboardLayout><PropertyDetail /></DashboardLayout>} />
      <Route path="/map" component={() => <DashboardLayout><MapView /></DashboardLayout>} />
      <Route path="/activity" component={() => <DashboardLayout><ActivityTracking /></DashboardLayout>} />
      <Route path="/import" component={() => <DashboardLayout><ImportProperties /></DashboardLayout>} />
      <Route path="/agent-performance" component={() => <DashboardLayout><AgentPerformance /></DashboardLayout>} />
      <Route path="/users" component={() => <DashboardLayout><UserManagement /></DashboardLayout>} />
      <Route path="/buyers" component={() => <DashboardLayout><Buyers /></DashboardLayout>} />
      <Route path="/buyers/:id" component={() => <DashboardLayout><BuyerDetail /></DashboardLayout>} />
      <Route path="/agents" component={() => <DashboardLayout><UserManagement /></DashboardLayout>} />
      <Route path="/agent-management" component={() => <DashboardLayout><UserManagement /></DashboardLayout>} />
      <Route path="/bulk-assign-agents" component={() => <DashboardLayout><BulkAgentAssignment /></DashboardLayout>} />
      <Route path="/import-dealmachine" component={() => <DashboardLayout><ImportDealMachine /></DashboardLayout>} />
      <Route path="/tasks/kanban" component={() => <DashboardLayout><TasksKanban /></DashboardLayout>} />
      <Route path="/tasks/list" component={() => <DashboardLayout><TasksList /></DashboardLayout>} />
      <Route path="/tasks/calendar" component={() => <DashboardLayout><TasksCalendar /></DashboardLayout>} />
      <Route path="/duplicates" component={() => <DashboardLayout><DuplicatesDashboard /></DashboardLayout>} />
      <Route path="/pipeline" component={() => <DashboardLayout><PipelineKanban /></DashboardLayout>} />
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
