import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, Marker, Autocomplete, useJsApiLoader } from '@react-google-maps/api';

const LIBRARIES: ('places')[] = ['places'];
const ARGENTINA_CENTER = { lat: -34.6037, lng: -58.3816 };

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
  city: string;
  googleMapsUrl: string;
}

interface GoogleMapPickerProps {
  value: LocationData | null;
  onChange: (loc: LocationData) => void;
  disabled?: boolean;
  /** Cuando el usuario elige una ciudad, se pasa su centroide para centrar el mapa */
  defaultCenter?: { lat: number; lng: number };
}

function extractCity(components: google.maps.GeocoderAddressComponent[]): string {
  for (const c of components) {
    if (c.types.includes('locality')) return c.long_name;
  }
  for (const c of components) {
    if (c.types.includes('administrative_area_level_2')) return c.long_name;
  }
  return '';
}

export function GoogleMapPicker({ value, onChange, disabled, defaultCenter }: GoogleMapPickerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const isFirstMount = useRef(true);

  const [marker, setMarker] = useState<google.maps.LatLngLiteral | null>(
    value ? { lat: value.lat, lng: value.lng } : null
  );

  // Cuando la ciudad cambia (no en el primer render), recentrar el mapa
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    if (!defaultCenter || !mapRef.current) return;
    mapRef.current.panTo(defaultCenter);
    mapRef.current.setZoom(14);
    // Sesgar el autocomplete hacia la ciudad seleccionada
    if (autocompleteRef.current) {
      const delta = 0.15;
      autocompleteRef.current.setBounds(new google.maps.LatLngBounds(
        { lat: defaultCenter.lat - delta, lng: defaultCenter.lng - delta },
        { lat: defaultCenter.lat + delta, lng: defaultCenter.lng + delta },
      ));
    }
  }, [defaultCenter]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyLocation = useCallback((lat: number, lng: number, address: string, city: string) => {
    setMarker({ lat, lng });
    onChange({ lat, lng, address, city, googleMapsUrl: `https://www.google.com/maps?q=${lat},${lng}` });
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(17);
  }, [onChange]);

  const handlePlaceChanged = useCallback(() => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    applyLocation(lat, lng, place.formatted_address || '', extractCity(place.address_components || []));
  }, [applyLocation]);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder();
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        applyLocation(lat, lng, results[0].formatted_address, extractCity(results[0].address_components || []));
      } else {
        applyLocation(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`, '');
      }
    });
  }, [applyLocation]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng || disabled) return;
    reverseGeocode(e.latLng.lat(), e.latLng.lng());
  }, [disabled, reverseGeocode]);

  const handleDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng || disabled) return;
    reverseGeocode(e.latLng.lat(), e.latLng.lng());
  }, [disabled, reverseGeocode]);

  if (!apiKey) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
        Google Maps no está configurado. Agregá{' '}
        <code className="font-mono bg-yellow-100 px-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
        en el archivo <code className="font-mono bg-yellow-100 px-1 rounded">.env</code>.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        Error al cargar Google Maps. Verificá que la API key tenga habilitadas Maps JavaScript API y Places API.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initialCenter = marker ?? defaultCenter ?? ARGENTINA_CENTER;
  const initialZoom   = marker ? 17 : defaultCenter ? 14 : 5;

  return (
    <div className="space-y-2">
      <Autocomplete
        onLoad={ac => { autocompleteRef.current = ac; }}
        onPlaceChanged={handlePlaceChanged}
        options={{ componentRestrictions: { country: 'ar' } }}
      >
        <input
          type="text"
          placeholder="Buscá la calle de tu tienda..."
          disabled={disabled}
          defaultValue={value?.address || ''}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50"
        />
      </Autocomplete>

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '300px', borderRadius: '12px', overflow: 'hidden' }}
        center={initialCenter}
        zoom={initialZoom}
        onClick={handleMapClick}
        onLoad={map => { mapRef.current = map; }}
        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
      >
        {marker && (
          <Marker
            position={marker}
            draggable={!disabled}
            onDragEnd={handleDragEnd}
          />
        )}
      </GoogleMap>

      {value?.address ? (
        <p className="text-xs text-gray-600 flex items-start gap-1.5">
          <span className="text-green-500 mt-0.5">✓</span>
          <span>{value.address}</span>
        </p>
      ) : (
        <p className="text-xs text-gray-400">
          Buscá la dirección o hacé clic en el mapa para marcar la ubicación exacta.
        </p>
      )}
    </div>
  );
}
