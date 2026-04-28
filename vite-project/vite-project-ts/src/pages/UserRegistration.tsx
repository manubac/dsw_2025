import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import { fetchApi } from "../services/api";

interface GeorefMunicipio {
  id: string;
  nombre: string;
  provincia: { nombre: string };
}

function CityPicker({ value, onChange }: { value: string; onChange: (city: string, province: string) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeorefMunicipio[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://apis.datos.gob.ar/georef/api/municipios?nombre=${encodeURIComponent(q)}&max=8&campos=id,nombre,provincia&orden=nombre`
        );
        const data = await res.json();
        setResults(data.municipios || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const select = (m: GeorefMunicipio) => {
    setQuery(`${m.nombre}, ${m.provincia.nombre}`);
    setOpen(false);
    onChange(m.nombre, m.provincia.nombre);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Ej: Rosario, Córdoba, La Plata..."
          autoComplete="off"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition pr-8"
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
            <li
              key={m.id}
              onMouseDown={() => select(m)}
              className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm flex items-center gap-2 transition"
            >
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium text-gray-800">{m.nombre}</span>
              <span className="text-gray-400 text-xs">{m.provincia.nombre}</span>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
          No se encontraron resultados
        </div>
      )}
    </div>
  );
}

export function UserRegistration() {
  const navigate = useNavigate();
  const { login } = useUser();

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    confirmPassword: "",
    ciudad: "",
    provincia: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetchApi("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.nombre,
          email: form.email,
          password: form.password,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Error al crear la cuenta.");

      // Auto-login
      const loginRes = await fetchApi("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const loginResult = await loginRes.json();
      if (!loginRes.ok) { navigate("/login"); return; }

      login(
        {
          id: loginResult.data.id,
          name: loginResult.data.username,
          email: loginResult.data.email,
          password: form.password,
          role: loginResult.role ?? "user",
          is_email_verified: loginResult.data.is_email_verified,
          is_phone_verified: loginResult.data.is_phone_verified,
        },
        loginResult.token
      );
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (p: string) => {
    if (!p) return null;
    if (p.length < 6) return { label: "Muy corta", color: "bg-red-400", width: "w-1/4" };
    if (p.length < 8) return { label: "Débil", color: "bg-orange-400", width: "w-2/4" };
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { label: "Media", color: "bg-yellow-400", width: "w-3/4" };
    return { label: "Fuerte", color: "bg-green-400", width: "w-full" };
  };
  const strength = passwordStrength(form.password);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">HeroClash</h1>
          <p className="text-gray-500 mt-1 text-sm">Creá tu cuenta de comprador</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Crear cuenta</h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nombre completo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo</label>
              <input
                type="text"
                value={form.nombre}
                onChange={set("nombre")}
                required
                disabled={loading}
                placeholder="Ej: Ash Ketchum"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                disabled={loading}
                placeholder="vos@ejemplo.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50"
              />
            </div>

            {/* Ciudad */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ciudad
                <span className="text-gray-400 font-normal ml-1">(Argentina)</span>
              </label>
              <CityPicker
                value={form.ciudad}
                onChange={(city, province) => setForm(prev => ({ ...prev, ciudad: city, provincia: province }))}
              />
              {form.provincia && (
                <p className="text-xs text-gray-400 mt-1">{form.provincia}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  required
                  disabled={loading}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50 pr-10"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                </button>
              </div>
              {strength && (
                <div className="mt-2 space-y-1">
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                  </div>
                  <p className="text-xs text-gray-400">{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmá tu contraseña</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  required
                  disabled={loading}
                  placeholder="Repetí tu contraseña"
                  className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm transition disabled:opacity-50 pr-10 ${
                    form.confirmPassword && form.confirmPassword !== form.password
                      ? "border-red-300 focus:border-red-400"
                      : "border-gray-200 focus:border-primary"
                  }`}
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showConfirm ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                </button>
              </div>
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm mt-2"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tenés cuenta?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Al registrarte aceptás nuestros términos y condiciones.
        </p>
      </div>
    </div>
  );
}
