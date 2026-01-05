import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MapPin, 
  FileText, 
  Image as ImageIcon, 
  Clock
} from "lucide-react";

interface ActivityTimelineProps {
  propertyId: number;
}

export function ActivityTimeline({ propertyId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = trpc.properties.getActivities.useQuery({ propertyId });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "check-in":
        return <MapPin className="h-4 w-4 text-blue-500" />;
      case "note":
        return <FileText className="h-4 w-4 text-green-500" />;
      case "photo":
        return <ImageIcon className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityTitle = (activity: { type: string; details: string }) => {
    switch (activity.type) {
      case "check-in":
        return "Property Check-In";
      case "note":
        return "Note Added";
      case "photo":
        return "Photo Uploaded";
      default:
        return "Activity";
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
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading activity history...</div>
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">No activity recorded yet</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-background border-2 border-border p-2">
                  {getActivityIcon(activity.type)}
                </div>
                {index < activities.length - 1 && (
                  <div className="w-0.5 h-full bg-border mt-2" />
                )}
              </div>

              {/* Activity content */}
              <div className="flex-1 pb-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{getActivityTitle(activity)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      by {activity.user} • {formatDate(activity.timestamp)}
                    </div>
                    
                    {/* Activity-specific content */}
                    {activity.type === "note" && activity.details && (
                      <div className="mt-2 text-sm bg-muted/50 p-3 rounded-md">
                        {activity.details}
                      </div>
                    )}
                    
                    {activity.type === "check-in" && activity.metadata?.latitude && (
                      <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Location: {activity.metadata.latitude.toFixed(6)}, {activity.metadata.longitude.toFixed(6)}
                      </div>
                    )}
                    
                    {activity.type === "photo" && activity.metadata?.url && (
                      <div className="mt-2">
                        <img 
                          src={activity.metadata.url} 
                          alt="Activity photo" 
                          className="rounded-md max-w-xs h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(activity.metadata.url, "_blank")}
                        />
                        {activity.details && activity.details !== "Uploaded photo" && (
                          <div className="mt-1 text-xs text-muted-foreground">{activity.details}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
