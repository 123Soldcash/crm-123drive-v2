import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { MapPin, Calendar, User, Navigation as NavIcon } from "lucide-react";

export default function ActivityTracking() {
  const { data: visits, isLoading } = trpc.visits.recent.useQuery({ limit: 100 }) as { data: any[] | undefined; isLoading: boolean };
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const handleMapReady = useCallback(
    async (mapInstance: google.maps.Map) => {
      setMap(mapInstance);

      if (!visits || visits.length === 0) return;

      const bounds = new google.maps.LatLngBounds();
      const validVisits = visits.filter((v) => v.latitude && v.longitude);

      // Create markers for each visit
      validVisits.forEach((visit) => {
        if (!visit.latitude || !visit.longitude) return;

        const position = {
          lat: parseFloat(visit.latitude),
          lng: parseFloat(visit.longitude),
        };
        bounds.extend(position);

        const markerContent = document.createElement("div");
        markerContent.innerHTML = `
          <div style="
            background: #10b981;
            border: 2px solid white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">
            ✓
          </div>
        `;

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapInstance,
          position,
          content: markerContent,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; max-width: 250px;">
              <h3 style="font-weight: bold; margin-bottom: 8px;">${visit.propertyAddress || "Unknown"}</h3>
              <p style="margin: 4px 0; font-size: 14px;">${visit.propertyCity}, ${visit.propertyState}</p>
              <p style="margin: 4px 0; font-size: 14px;">Visited by: ${visit.userName || "Unknown"}</p>
              <p style="margin: 4px 0; font-size: 14px;">
                ${new Date(visit.checkInTime).toLocaleString()}
              </p>
              ${visit.notes ? `<p style="margin: 8px 0 4px 0; font-size: 13px; color: #666;">${visit.notes}</p>` : ""}
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open(mapInstance, marker);
        });
      });

      // Draw path connecting visits in chronological order
      if (validVisits.length > 1) {
        const path = validVisits.map((v) => ({
          lat: parseFloat(v.latitude!),
          lng: parseFloat(v.longitude!),
        }));

        new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.6,
          strokeWeight: 3,
          map: mapInstance,
        });
      }

      if (validVisits.length > 0) {
        mapInstance.fitBounds(bounds);
      }
    },
    [visits]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Tracking</h1>
        <p className="text-muted-foreground mt-2">
          Track field agent visits and routes
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="h-[600px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading activity map...</div>
                </div>
              ) : (
                <MapView
                  onMapReady={handleMapReady}
                  className="h-[600px] w-full"
                  initialCenter={{ lat: 26.011, lng: -80.149 }}
                  initialZoom={12}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[550px] overflow-y-auto">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading visits...</p>
                ) : visits && visits.length > 0 ? (
                  visits.map((visit) => (
                    <Link key={visit.id} href={`/properties/${visit.propertyId}`}>
                      <div className="border rounded-lg p-3 hover:bg-accent cursor-pointer space-y-2">
                        <div className="font-medium text-sm">
                          {visit.propertyAddress || "Unknown Address"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {visit.propertyCity}, {visit.propertyState}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{visit.userName || "Unknown"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(visit.checkInTime).toLocaleString()}</span>
                        </div>
                        {visit.latitude && visit.longitude && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>
                              {parseFloat(visit.latitude).toFixed(4)}, {parseFloat(visit.longitude).toFixed(4)}
                            </span>
                          </div>
                        )}
                        {visit.notes && (
                          <p className="text-xs bg-muted p-2 rounded mt-2">
                            {visit.notes}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No visits recorded yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
