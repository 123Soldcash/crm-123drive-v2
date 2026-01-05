import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { MapView } from "@/components/Map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Navigation } from "lucide-react";
import { toast } from "sonner";

export default function MapViewPage() {
  const [, setLocation] = useLocation();
  const { data: properties, isLoading } = trpc.properties.forMap.useQuery();
  const [selectedProperties, setSelectedProperties] = useState<number[]>([]);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  const handleMapReady = useCallback(
    async (mapInstance: google.maps.Map) => {
      setMap(mapInstance);

      if (!properties || properties.length === 0) return;

      // Clear existing markers
      markers.forEach((marker) => marker.map = null);
      setMarkers([]);

      const bounds = new google.maps.LatLngBounds();
      const geocoder = new google.maps.Geocoder();
      const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

      // Geocode and create markers for each property
      for (const property of properties) {
        const address = `${property.addressLine1}, ${property.city}, ${property.state} ${property.zipcode}`;

        try {
          const result = await geocoder.geocode({ address });
          if (result.results[0]) {
            const position = result.results[0].geometry.location;
            bounds.extend(position);

            const markerContent = document.createElement("div");
            markerContent.className = "custom-marker";
            markerContent.innerHTML = `
              <div style="
                background: white;
                border: 2px solid #2563eb;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: #2563eb;
                cursor: pointer;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">
                $
              </div>
            `;

            const marker = new google.maps.marker.AdvancedMarkerElement({
              map: mapInstance,
              position,
              content: markerContent,
              title: property.addressLine1,
            });

            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; max-width: 250px;">
                  <h3 style="font-weight: bold; margin-bottom: 8px;">${property.addressLine1}</h3>
                  <p style="margin: 4px 0; font-size: 14px;">${property.city}, ${property.state}</p>
                  <p style="margin: 4px 0; font-size: 14px;">Owner: ${property.owner1Name || "N/A"}</p>
                  <p style="margin: 4px 0; font-size: 14px;">Value: $${property.estimatedValue?.toLocaleString() || "N/A"}</p>
                  <p style="margin: 4px 0; font-size: 14px;">Equity: ${property.equityPercent || 0}%</p>
                  <button 
                    onclick="window.location.href='/properties/${property.id}'"
                    style="
                      margin-top: 8px;
                      padding: 6px 12px;
                      background: #2563eb;
                      color: white;
                      border: none;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 14px;
                    "
                  >
                    View Details
                  </button>
                </div>
              `,
            });

            marker.addListener("click", () => {
              infoWindow.open(mapInstance, marker);
            });

            newMarkers.push(marker);
          }
        } catch (error) {
          console.error(`Failed to geocode ${address}:`, error);
        }
      }

      setMarkers(newMarkers);
      if (newMarkers.length > 0) {
        mapInstance.fitBounds(bounds);
      }
    },
    [properties, markers]
  );

  const planRoute = useCallback(async () => {
    if (!map || selectedProperties.length < 2) {
      toast.error("Please select at least 2 properties to plan a route");
      return;
    }

    if (!properties) return;

    const selectedProps = properties.filter((p) => selectedProperties.includes(p.id));
    const waypoints = selectedProps.slice(1, -1).map((p) => ({
      location: `${p.addressLine1}, ${p.city}, ${p.state} ${p.zipcode}`,
      stopover: true,
    }));

    const origin = selectedProps[0];
    const destination = selectedProps[selectedProps.length - 1];

    const directionsService = new google.maps.DirectionsService();
    
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
    }

    const newRenderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
    });
    setDirectionsRenderer(newRenderer);

    try {
      const result = await directionsService.route({
        origin: `${origin.addressLine1}, ${origin.city}, ${origin.state} ${origin.zipcode}`,
        destination: `${destination.addressLine1}, ${destination.city}, ${destination.state} ${destination.zipcode}`,
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      newRenderer.setDirections(result);
      toast.success("Route planned successfully!");
    } catch (error) {
      console.error("Route planning failed:", error);
      toast.error("Failed to plan route. Please try again.");
    }
  }, [map, selectedProperties, properties, directionsRenderer]);

  const clearRoute = useCallback(() => {
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
      setDirectionsRenderer(null);
    }
    setSelectedProperties([]);
    toast.success("Route cleared");
  }, [directionsRenderer]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/properties">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Properties
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Property Map</h1>
          <p className="text-muted-foreground mt-2">
            View all properties on the map and plan your route
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={planRoute} disabled={selectedProperties.length < 2}>
            <Navigation className="mr-2 h-4 w-4" />
            Plan Route ({selectedProperties.length})
          </Button>
          {directionsRenderer && (
            <Button variant="outline" onClick={clearRoute}>
              Clear Route
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="h-[600px] flex items-center justify-center">
                  <div className="text-muted-foreground">Loading map...</div>
                </div>
              ) : (
                <MapView
                  onMapReady={handleMapReady}
                  className="h-[600px] w-full"
                  initialCenter={{ lat: 26.011, lng: -80.149 }}
                  initialZoom={13}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Route Planning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click on property markers to view details. Select properties below to plan an optimized route.
                </p>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {properties?.map((property) => (
                    <div
                      key={property.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProperties.includes(property.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-accent"
                      }`}
                      onClick={() => {
                        setSelectedProperties((prev) =>
                          prev.includes(property.id)
                            ? prev.filter((id) => id !== property.id)
                            : [...prev, property.id]
                        );
                      }}
                    >
                      <div className="font-medium text-sm">{property.addressLine1}</div>
                      <div className="text-xs text-muted-foreground">
                        {property.city}, {property.state}
                      </div>
                      {selectedProperties.includes(property.id) && (
                        <div className="text-xs text-primary font-medium mt-1">
                          Stop #{selectedProperties.indexOf(property.id) + 1}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
