import { useState, useRef, useEffect } from 'react';

interface GeorefMunicipio {
  id: string;
  nombre: string;
  provincia: { nombre: string };
  centroide: { lat: number; lon: number };
}

export interface CityPickerResult {
  city: string;
  province: string;
  center: { lat: number; lng: number };
}

interface CityPickerProps {
  value: string;
  onChange: (result: CityPickerResult) => void;
  disabled?: boolean;
  inputClassName?: string;
}

export function CityPicker({ value, onChange, disabled, inputClassName }: CityPickerProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeorefMunicipio[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://apis.datos.gob.ar/georef/api/municipios?nombre=${encodeURIComponent(q)}&max=8&campos=id,nombre,provincia,centroide&orden=nombre`
        );
        const data = await res.json();
        setResults(data.municipios || []);
        setOpen(true);
      } catch { setResults([]); } finally { setLoading(false); }
    }, 300);
  };

  const select = (m: GeorefMunicipio) => {
    setQuery(`${m.nombre}, ${m.provincia.nombre}`);
    setOpen(false);
    onChange({
      city: m.nombre,
      province: m.provincia.nombre,
      center: { lat: m.centroide.lat, lng: m.centroide.lon },
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text" value={query} onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Ej: Rosario, Córdoba, La Plata..." autoComplete="off"
          disabled={disabled}
          className={inputClassName ?? 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50 pr-8'}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map(m => (
            <li key={m.id} onMouseDown={() => select(m)}
              className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm flex items-center gap-2 transition">
              <span className="font-medium text-gray-800">{m.nombre}</span>
              <span className="text-gray-400 text-xs">{m.provincia.nombre}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
