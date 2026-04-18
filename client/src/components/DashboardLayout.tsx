import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Building2, MapPin, Activity, Upload, TrendingUp, Users, CheckSquare, Zap, GitMerge, Workflow, LogIn, MessageSquare, FileText, Phone, Layers, Link2, History } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { useNotificationPolling } from "@/hooks/useNotificationPolling";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Building2, label: "Properties", path: "/properties" },
  { icon: Workflow, label: "Pipeline", path: "/pipeline" },
  { icon: MapPin, label: "Map View", path: "/map" },
  { icon: CheckSquare, label: "Tasks", path: "/tasks/kanban" },
  { icon: FileText, label: "Message Templates", path: "/message-templates" },
  { icon: Users, label: "Buyers", path: "/buyers" },
  { icon: Activity, label: "Activity Tracking", path: "/activity" },
  { icon: Phone, label: "Communication Channels", path: "/call-history" },
  { icon: History, label: "Comms History", path: "/comms-history", adminOnly: true },
  { icon: Upload, label: "Import Properties", path: "/import", adminOnly: true },
  { icon: TrendingUp, label: "Agent Performance", path: "/agent-performance", adminOnly: true },
  { icon: Users, label: "User Management", path: "/users", adminOnly: true },
  { icon: Phone, label: "Twilio Numbers", path: "/twilio-numbers", adminOnly: true },
  { icon: Zap, label: "Bulk Assign Agents", path: "/bulk-assign-agents", adminOnly: true },
  { icon: Layers, label: "Desk Management", path: "/desk-management", adminOnly: true },
  { icon: Link2, label: "Integrations", path: "/integrations", adminOnly: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const isMobile = useIsMobile();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="flex flex-col items-center gap-8 p-10 max-w-md w-full">
          {/* Logo / Brand */}
          <div className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 rounded-2xl bg-blue-700 flex items-center justify-center shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">
              CRM 123Drive
            </h1>
          </div>

          {/* Access Denied Alert */}
          {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('access') === 'denied' && (
            <div className="w-full bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-sm text-red-700 font-medium">
                Acesso negado. Sua conta não está cadastrada no sistema.
              </p>
              <p className="text-xs text-red-600 mt-1">
                Solicite um link de convite ao administrador para participar.
              </p>
            </div>
          )}

          {/* Login Card */}
          <div className="w-full bg-white rounded-xl border shadow-sm p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                Entrar na sua conta
              </h2>
              <p className="text-sm text-muted-foreground">
                Acesse o painel com suas credenciais.
              </p>
            </div>

            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              size="lg"
              className="w-full shadow-md hover:shadow-lg transition-all text-base font-medium"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Entrar
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Acesso restrito</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Este sistema é exclusivo para membros convidados.
              Para participar, solicite um link de convite ao administrador.
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground/60">
            123Drive &middot; Painel de Gestão de Leads
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{
        // Only apply custom width on desktop; mobile uses its own Sheet width
        // Check both the hook and window.innerWidth to handle initial render
        ...((isMobile || (typeof window !== 'undefined' && window.innerWidth < 768)) ? {} : { "--sidebar-width": `${sidebarWidth}px` }),
      } as unknown as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  // Global notification polling — fires toasts for new SMS and missed calls
  useNotificationPolling();

  // Overdue tasks count badge — always scoped to the logged-in user only
  const { data: overdueTasksData } = trpc.tasks.list.useQuery(
    { onlyMine: true },
    {
      refetchInterval: 60_000, // poll every 60s
      enabled: !!user,
      select: (tasks) => ({
        count: tasks.filter(t => {
          if (t.status === "Done" || !t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d < new Date() && d.toDateString() !== new Date().toDateString();
        }).length,
      }),
    }
  );
  const overdueTasksCount = overdueTasksData?.count ?? 0;

  // Unread SMS count badge
  const { data: unreadSmsData } = trpc.sms.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000, // poll every 30s
    enabled: !!user,
  });
  const unreadSmsCount = unreadSmsData?.count ?? 0;

  // Needs-callback count badge
  const { data: callbackData } = trpc.callHistory.needsCallbackCount.useQuery(undefined, {
    refetchInterval: 30_000,
    enabled: !!user,
  });
  const needsCallbackCount = callbackData?.count ?? 0;

  // Total badge for Communication Channels sidebar item
  const commBadgeCount = unreadSmsCount + needsCallbackCount;

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Navigation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems
                .filter(item => !item.adminOnly || user?.role === 'admin')
                .map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <div className="relative shrink-0">
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                        />
                        {item.path === "/call-history" && commBadgeCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center leading-none">
                            {commBadgeCount > 9 ? "9+" : commBadgeCount}
                          </span>
                        )}
                        {item.path === "/tasks/kanban" && overdueTasksCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center leading-none">
                            {overdueTasksCount > 9 ? "9+" : overdueTasksCount}
                          </span>
                        )}
                      </div>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.path === "/call-history" && commBadgeCount > 0 && !isCollapsed && (
                        <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                          {commBadgeCount > 99 ? "99+" : commBadgeCount}
                        </span>
                      )}
                      {item.path === "/tasks/kanban" && overdueTasksCount > 0 && !isCollapsed && (
                        <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                          {overdueTasksCount > 99 ? "99+" : overdueTasksCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Top bar — always visible on mobile, also shown on desktop for the bell */}
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />}
            {isMobile && (
              <span className="tracking-tight text-foreground">
                {activeMenuItem?.label ?? "Menu"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
          </div>
        </div>
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
