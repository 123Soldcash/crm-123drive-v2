import { trpc } from "@/lib/trpc";
import { 
  MapPin, 
  FileText, 
  Image as ImageIcon, 
  Clock,
  History
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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "check-in":
        return <MapPin className="h-3 w-3 text-blue-500" />;
      case "note":
        return <FileText className="h-3 w-3 text-emerald-500" />;
      case "photo":
        return <ImageIcon className="h-3 w-3 text-purple-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const getActivityTitle = (activity: { type: string; details: string }) => {
    switch (activity.type) {
      case "check-in": return "Property Check-In";
      case "note": return "Note Added";
      case "photo": return "Photo Uploaded";
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
      hour: "2-digit",
      minute: "2-digit"
    });
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
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm z-10 shrink-0">
                {getActivityIcon(activity.type)}
              </div>

              <div className="flex-1 pt-1 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-sm text-slate-900">{getActivityTitle(activity)}</div>
                  <div className="text-[10px] text-gray-500 font-medium">{formatDate(activity.timestamp)}</div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  by <span className="font-semibold text-slate-700">{activity.user}</span>
                </div>
                
                {activity.type === "note" && activity.details && (
                  <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {activity.details}
                  </div>
                )}
                
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
                      className="rounded-lg border border-slate-200 max-w-xs h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
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
