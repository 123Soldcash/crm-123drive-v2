import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Home, AlertTriangle, ExternalLink } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Link } from 'wouter';

interface AddressAutocompleteWithCRMProps {
  value: string;
  onChange: (address: string) => void;
  onAddressSelect?: (details: AddressDetails) => void;
  onExistingLeadSelect?: (leadId: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface AddressDetails {
  address: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

interface CRMMatch {
  id: number;
  addressLine1: string;
  city: string;
  state: string;
  zipcode: string;
  owner1Name: string | null;
  leadTemperature: string | null;
}

export function AddressAutocompleteWithCRM({
  value,
  onChange,
  onAddressSelect,
  onExistingLeadSelect,
  placeholder = "Enter property address...",
  disabled = false,
}: AddressAutocompleteWithCRMProps) {
  const [googleSuggestions, setGoogleSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState('');
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce the search value
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  // Search CRM for matching addresses
  const { data: crmMatches, isLoading: crmLoading } = trpc.properties.searchByAddress.useQuery(
    { search: debouncedValue },
    { 
      enabled: debouncedValue.length >= 3,
      refetchOnWindowFocus: false,
    }
  );

  // Initialize Google Places services
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      placesService.current = new window.google.maps.places.PlacesService(
        document.createElement('div')
      );
    }
  }, []);

  // Handle address input change
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    onChange(input);

    if (input.length < 3) {
      setGoogleSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);
    setLoading(true);
    
    try {
      if (autocompleteService.current) {
        const predictions = await autocompleteService.current.getPlacePredictions({
          input,
          componentRestrictions: { country: 'us' },
          types: ['address'],
        });
        setGoogleSuggestions(predictions.predictions || []);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setGoogleSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google suggestion selection
  const handleSelectGoogleSuggestion = async (placeId: string, description: string) => {
    onChange(description);
    setShowSuggestions(false);

    if (placesService.current && onAddressSelect) {
      try {
        const details = await new Promise<any>((resolve, reject) => {
          placesService.current.getDetails(
            { placeId, fields: ['formatted_address', 'address_components', 'geometry'] },
            (result: any, status: any) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                resolve(result);
              } else {
                reject(new Error(`Places service error: ${status}`));
              }
            }
          );
        });

        const addressComponents = details.address_components || [];
        const addressDetails: AddressDetails = {
          address: details.formatted_address || description,
          street: getAddressComponent(addressComponents, 'street_number') + ' ' + getAddressComponent(addressComponents, 'route'),
          city: getAddressComponent(addressComponents, 'locality'),
          state: getAddressComponent(addressComponents, 'administrative_area_level_1'),
          zipCode: getAddressComponent(addressComponents, 'postal_code'),
          lat: details.geometry?.location?.lat() || undefined,
          lng: details.geometry?.location?.lng() || undefined,
          placeId,
        };

        onAddressSelect(addressDetails);
      } catch (error) {
        console.error('Error getting place details:', error);
      }
    }
  };

  // Handle CRM lead selection
  const handleSelectCRMLead = (lead: CRMMatch) => {
    if (onExistingLeadSelect) {
      onExistingLeadSelect(lead.id);
    }
    setShowSuggestions(false);
  };

  // Helper function to extract address components
  const getAddressComponent = (components: any[], type: string): string => {
    const component = components.find((c: any) => c.types.includes(type));
    return component?.long_name || '';
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasCRMMatches = crmMatches && crmMatches.length > 0;
  const hasGoogleSuggestions = googleSuggestions.length > 0;
  const showDropdown = showSuggestions && (hasCRMMatches || hasGoogleSuggestions || loading || crmLoading);

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 3 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10"
          autoComplete="off"
        />
        {(loading || crmLoading) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Combined suggestions dropdown */}
      {showDropdown && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-input rounded-md shadow-lg max-h-80 overflow-y-auto"
        >
          {/* CRM Matches Section - FIRST and PROMINENT */}
          {hasCRMMatches && (
            <div className="border-b border-amber-200 bg-amber-50 dark:bg-amber-950">
              <div className="px-3 py-2 flex items-center gap-2 bg-amber-100 dark:bg-amber-900 border-b border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  ⚠️ Leads Existentes no CRM ({crmMatches.length})
                </span>
              </div>
              {crmMatches.slice(0, 5).map((lead: CRMMatch) => (
                <div
                  key={lead.id}
                  className="px-3 py-2 hover:bg-amber-100 dark:hover:bg-amber-900 border-b border-amber-100 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Home className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-amber-900 dark:text-amber-100">
                          {lead.addressLine1}
                        </div>
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                          {lead.city}, {lead.state} {lead.zipcode}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-amber-600">Lead #{lead.id}</span>
                          {lead.owner1Name && (
                            <span className="text-xs text-amber-600">• {lead.owner1Name}</span>
                          )}
                          {lead.leadTemperature && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                lead.leadTemperature === 'HOT' ? 'bg-red-100 text-red-800 border-red-300' :
                                lead.leadTemperature === 'WARM' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                lead.leadTemperature === 'COLD' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                'bg-gray-100 text-gray-800 border-gray-300'
                              }`}
                            >
                              {lead.leadTemperature}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`/properties/${lead.id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCRMLead(lead);
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ver Lead
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {crmMatches.length > 5 && (
                <div className="px-3 py-1 text-xs text-amber-600 bg-amber-50">
                  +{crmMatches.length - 5} mais leads encontradas...
                </div>
              )}
            </div>
          )}

          {/* Google Maps Suggestions Section */}
          {hasGoogleSuggestions && (
            <div>
              {hasCRMMatches && (
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b text-xs text-gray-500 flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  Novos Endereços (Google Maps)
                </div>
              )}
              {googleSuggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  onClick={() => handleSelectGoogleSuggestion(suggestion.place_id, suggestion.description)}
                  className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{suggestion.structured_formatting?.main_text || suggestion.description}</div>
                      <div className="text-sm text-muted-foreground truncate">{suggestion.structured_formatting?.secondary_text}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {(loading || crmLoading) && !hasCRMMatches && !hasGoogleSuggestions && (
            <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando endereços...
            </div>
          )}

          {/* No results */}
          {!loading && !crmLoading && !hasCRMMatches && !hasGoogleSuggestions && value.length >= 3 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Nenhum endereço encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
