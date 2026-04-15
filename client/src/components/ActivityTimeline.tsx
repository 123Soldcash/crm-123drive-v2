import { trpc } from "@/lib/trpc";
import { 
  MapPin, 
  FileText, 
  Image as ImageIcon, 
  Clock,
  History,
  Phone,
  MessageSquare,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import { Badge } from "@/components/ui/badge";

interface ActivityTimelineProps {
  propertyId: number;
}

export function ActivityTimeline({ propertyId }: ActivityTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('showActivityTimeline');
    return saved ? JSON.parse(saved) : false;
  });
  
  useEffect(() => {
    localStorage.setItem('showActivityTimeline', JSON.stringify(isExpanded));
  }, [isExpanded]);
  
  const { data: activities, isLoading } = trpc.properties.getActivities.useQuery({ propertyId });

  const getActivityIcon = (type: string, metadata?: any) => {
    switch (type) {
      case "check-in":
        return <MapPin className="h-3 w-3 text-blue-500" />;
      case "note":
        return <FileText className="h-3 w-3 text-emerald-500" />;
      case "photo":
        return <ImageIcon className="h-3 w-3 text-purple-500" />;
      case "call": {
        const isMissed = metadata?.isMissed;
        const direction = metadata?.direction;
        if (isMissed) return <PhoneMissed className="h-3 w-3 text-red-500" />;
        if (direction === "Inbound") return <PhoneIncoming className="h-3 w-3 text-green-500" />;
        return <PhoneOutgoing className="h-3 w-3 text-blue-500" />;
      }
      case "sms":
        return <MessageSquare className="h-3 w-3 text-violet-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const getActivityIconBg = (type: string, metadata?: any) => {
    switch (type) {
      case "check-in": return "bg-blue-50 border-blue-200";
      case "note": return "bg-emerald-50 border-emerald-200";
      case "photo": return "bg-purple-50 border-purple-200";
      case "call": {
        const isMissed = metadata?.isMissed;
        const direction = metadata?.direction;
        if (isMissed) return "bg-red-50 border-red-200";
        if (direction === "Inbound") return "bg-green-50 border-green-200";
        return "bg-blue-50 border-blue-200";
      }
      case "sms": return "bg-violet-50 border-violet-200";
      default: return "bg-white border-slate-200";
    }
  };

  const getActivityTitle = (activity: { type: string; details: string; metadata?: any }) => {
    switch (activity.type) {
      case "check-in": return "Property Check-In";
      case "note": return "Note Added";
      case "photo": return "Photo Uploaded";
      case "call": {
        const isMissed = activity.metadata?.isMissed;
        const direction = activity.metadata?.direction;
        if (isMissed) return "Missed Call";
        if (direction === "Inbound") return "Inbound Call";
        return "Outbound Call";
      }
      case "sms": {
        const direction = activity.metadata?.direction;
        if (direction === "inbound") return "Inbound SMS";
        return "Outbound SMS";
      }
      default: return "Activity";
    }
  };

  const formatDate = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatPhone = (phone: string | undefined | null) => {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <CollapsibleSection
      title="Activity Timeline"
      icon={History}
      isOpen={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      accentColor="purple"
      badge={activities && activities.length > 0 ? (
        <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 ml-1">
          {activities.length}
        </Badge>
      ) : null}
    >
      {isLoading ? (
        <div className="h-12 flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">Loading history...</div>
      ) : !activities || activities.length === 0 ? (
        <div className="py-6 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
          <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-slate-500">No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
          {activities.map((activity) => (
            <div key={activity.id} className="relative flex items-start gap-4">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border shadow-sm z-10 shrink-0 ${getActivityIconBg(activity.type, activity.metadata)}`}>
                {getActivityIcon(activity.type, activity.metadata)}
              </div>

              <div className="flex-1 pt-1 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-bold text-sm text-slate-900">{getActivityTitle(activity)}</div>
                    {/* Direction badge for calls */}
                    {activity.type === "call" && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        activity.metadata?.isMissed
                          ? "bg-red-100 text-red-700"
                          : activity.metadata?.direction === "Inbound"
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {activity.metadata?.isMissed
                          ? <><PhoneMissed className="h-2.5 w-2.5 mr-0.5" />Missed</>
                          : activity.metadata?.direction === "Inbound"
                          ? <><ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />Inbound</>
                          : <><ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />Outbound</>
                        }
                      </span>
                    )}
                    {/* Direction badge for SMS */}
                    {activity.type === "sms" && (
                      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        activity.metadata?.direction === "inbound"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}>
                        {activity.metadata?.direction === "inbound"
                          ? <><ArrowDownLeft className="h-2.5 w-2.5 mr-0.5" />Inbound</>
                          : <><ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />Outbound</>
                        }
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 font-medium shrink-0">{formatDate(activity.timestamp)}</div>
                </div>

                {/* User attribution */}
                <div className="text-xs text-slate-500 mt-0.5">
                  by <span className="font-semibold text-slate-700">{activity.user}</span>
                </div>

                {/* ── Call details ── */}
                {activity.type === "call" && (
                  <div className="mt-2 bg-slate-50 rounded-lg border border-slate-100 p-2.5 space-y-1.5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wide">From</span>
                        <div className="font-semibold text-slate-700 font-mono text-[11px] mt-0.5">{formatPhone(activity.metadata?.from)}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wide">To</span>
                        <div className="font-semibold text-slate-700 font-mono text-[11px] mt-0.5">{formatPhone(activity.metadata?.to)}</div>
                      </div>
                    </div>
                    {activity.details && activity.details !== "Call" && activity.details !== "Missed Call" && (
                      <div className="text-xs border-t border-slate-100 pt-1.5 mt-1.5">
                        <span className="text-slate-400 font-medium">Result: </span>
                        <span className={`font-semibold ${
                          activity.details.includes("HOT") ? "text-red-600" :
                          activity.details.includes("WARM") ? "text-orange-500" :
                          activity.details.includes("DEAD") || activity.details.includes("Irate") ? "text-gray-500" :
                          "text-slate-700"
                        }`}>{activity.details}</span>
                      </div>
                    )}
                    {activity.metadata?.deskName && (
                      <div className="text-xs">
                        <span className="text-slate-400 font-medium">Desk: </span>
                        <span className="font-medium text-indigo-600">{activity.metadata.deskName}</span>
                      </div>
                    )}
                    {activity.metadata?.notes && (
                      <div className="text-xs text-slate-600 italic border-t border-slate-100 pt-1.5 mt-1.5">
                        {activity.metadata.notes.length > 100
                          ? activity.metadata.notes.substring(0, 100) + "…"
                          : activity.metadata.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* ── SMS details ── */}
                {activity.type === "sms" && (
                  <div className="mt-2 bg-violet-50 rounded-lg border border-violet-100 p-2.5 space-y-1.5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-violet-400 font-medium text-[10px] uppercase tracking-wide">From</span>
                        <div className="font-semibold text-slate-700 font-mono text-[11px] mt-0.5">{formatPhone(activity.metadata?.from)}</div>
                      </div>
                      <div>
                        <span className="text-violet-400 font-medium text-[10px] uppercase tracking-wide">To</span>
                        <div className="font-semibold text-slate-700 font-mono text-[11px] mt-0.5">{formatPhone(activity.metadata?.to)}</div>
                      </div>
                    </div>
                    {activity.details && (
                      <div className="text-xs text-slate-700 border-t border-violet-100 pt-1.5 mt-1.5 leading-relaxed">
                        {activity.details}
                      </div>
                    )}
                    {activity.metadata?.status && activity.metadata.status !== "received" && (
                      <div className="text-[10px] mt-1">
                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                          activity.metadata.status === "delivered" ? "bg-green-100 text-green-700" :
                          activity.metadata.status === "failed" || activity.metadata.status === "undelivered" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{activity.metadata.status}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Note details ── */}
                {activity.type === "note" && activity.details && (
                  <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {activity.details}
                  </div>
                )}
                
                {/* ── Photo details ── */}
                {activity.type === "photo" && activity.metadata?.url && (
                  <div className="mt-2">
                    {activity.metadata?.source === 'note' && (
                      <div className="text-[10px] text-amber-600 font-medium mb-1">📋 From General Notes</div>
                    )}
                    {activity.metadata?.source === 'property' && (
                      <div className="text-[10px] text-blue-600 font-medium mb-1">🏠 Property Photo</div>
                    )}
                    <img 
                      src={activity.metadata.url} 
                      alt="Activity photo" 
                      className="rounded-lg border border-slate-200 max-w-xs sm:max-w-sm h-24 sm:h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(activity.metadata.url, "_blank")}
                    />
                    {activity.details && activity.details !== "Property photo uploaded" && activity.details !== "Screenshot added to note" && (
                      <div className="mt-1 text-[10px] text-gray-500 italic">{activity.details}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
