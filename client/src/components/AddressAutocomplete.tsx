import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onAddressSelect?: (details: AddressDetails) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface AddressDetails {
  address: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Enter property address...",
  disabled = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

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
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      if (autocompleteService.current) {
        const predictions = await autocompleteService.current.getPlacePredictions({
          input,
          componentRestrictions: { country: 'us' },
          types: ['address'],
        });

        setSuggestions(predictions.predictions || []);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = async (placeId: string, description: string) => {
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

        // Parse address components
        const addressComponents = details.address_components || [];
        const addressDetails: AddressDetails = {
          address: details.formatted_address || description,
          street: getAddressComponent(addressComponents, 'street_number') + ' ' + getAddressComponent(addressComponents, 'route'),
          city: getAddressComponent(addressComponents, 'locality'),
          state: getAddressComponent(addressComponents, 'administrative_area_level_1'),
          zipCode: getAddressComponent(addressComponents, 'postal_code'),
          latitude: details.geometry?.location?.lat() || 0,
          longitude: details.geometry?.location?.lng() || 0,
          placeId,
        };

        onAddressSelect(addressDetails);
      } catch (error) {
        console.error('Error getting place details:', error);
      }
    }
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
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-input rounded-md shadow-md max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              onClick={() => handleSelectSuggestion(suggestion.place_id, suggestion.description)}
              className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground outline-none transition-colors"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{suggestion.main_text}</div>
                  <div className="text-sm text-muted-foreground truncate">{suggestion.secondary_text}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showSuggestions && !loading && suggestions.length === 0 && value.length >= 3 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-input rounded-md shadow-md px-4 py-2 text-sm text-muted-foreground">
          No addresses found
        </div>
      )}
    </div>
  );
}
