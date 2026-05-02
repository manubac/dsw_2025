import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import { fetchApi } from '../services/api';
import { HorarioGrid, HorarioSemanal, HORARIO_DEFAULT } from '../components/HorarioGrid';
import { CityPicker } from '../components/CityPicker';
import { GoogleMapPicker, LocationData } from '../components/GoogleMapPicker';

// ── Types ──────────────────────────────────────────────────────────────────
type Step = 'LOADING' | 'INVALID' | 'FORM' | 'EMAIL_CODE' | 'PHONE_CODE' | 'SUCCESS';

interface FormData {
  nombreTienda: string;
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
  telefono: string;
  // Location - filled exclusively via GoogleMapPicker
  direccion: string;
  ciudad: string;
  latitud: number | null;
  longitud: number | null;
  googleMapsUrl: string;
  // Additional address detail
  piso: string;
  departamento: string;
  alias: string;
  cbu: string;
  descripcion: string;
  horario: HorarioSemanal;
}

// ── Main component ──────────────────────────────────────────────────────────
export function StoreRegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useUser();
  const token = searchParams.get('token') ?? '';

  const [step, setStep] = useState<Step>('LOADING');
  const [form, setForm] = useState<FormData>({
    nombreTienda: '', email: '', confirmEmail: '', password: '',
    confirmPassword: '', telefono: '',
    direccion: '', ciudad: '', latitud: null, longitud: null, googleMapsUrl: '',
    piso: '', departamento: '', alias: '', cbu: '', descripcion: '', horario: HORARIO_DEFAULT,
  });
  const [cityCenter, setCityCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setStep('INVALID'); return; }
    fetchApi(`/api/store-register/validate?token=${token}`)
      .then(r => r.json())
      .then(data => setStep(data.valid ? 'FORM' : 'INVALID'))
      .catch(() => setStep('INVALID'));
  }, [token]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleLocationChange = (loc: LocationData) => {
    setForm(prev => ({
      ...prev,
      direccion: loc.address,
      ciudad: loc.city,
      latitud: loc.lat,
      longitud: loc.lng,
      googleMapsUrl: loc.googleMapsUrl,
    }));
  };

  const passwordStrength = (p: string) => {
    if (!p) return null;
    if (p.length < 6) return { label: 'Muy corta', color: 'bg-red-400', width: 'w-1/4' };
    if (p.length < 8) return { label: 'Débil', color: 'bg-orange-400', width: 'w-2/4' };
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { label: 'Media', color: 'bg-yellow-400', width: 'w-3/4' };
    return { label: 'Fuerte', color: 'bg-green-400', width: 'w-full' };
  };
  const strength = passwordStrength(form.password);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.email !== form.confirmEmail) { setError('Los emails no coinciden.'); return; }
    if (form.password !== form.confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (!/^\+54 9 \d{4} \d{4}$/.test(form.telefono)) {
      setError('Formato de teléfono inválido. Usá +54 9 XXXX XXXX'); return;
    }
    if (form.latitud === null || form.longitud === null) {
      setError('Seleccioná la ubicación de tu tienda en el mapa.'); return;
    }
    setStep('EMAIL_CODE');
  };

  const handleEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchApi('/api/store-register/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code: emailCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep('PHONE_CODE');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const phoneRes = await fetchApi('/api/store-register/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code: phoneCode }),
      });
      const phoneData = await phoneRes.json();
      if (!phoneRes.ok) throw new Error(phoneData.message);

      const completeRes = await fetchApi('/api/store-register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nombreTienda: form.nombreTienda,
          email: form.email,
          password: form.password,
          telefono: form.telefono,
          ciudad: form.ciudad,
          direccion: form.direccion,
          latitud: form.latitud,
          longitud: form.longitud,
          googleMapsUrl: form.googleMapsUrl,
          piso: form.piso,
          departamento: form.departamento,
          alias: form.alias,
          cbu: form.cbu,
          descripcion: form.descripcion,
          horario: form.horario,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.message);

      login(
        {
          id: completeData.data.id,
          name: completeData.data.name,
          email: completeData.data.email,
          password: '',
          role: 'tiendaRetiro',
          is_email_verified: true,
          is_phone_verified: true,
        },
        completeData.token
      );
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50';

  if (step === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Validando invitación...</p>
      </div>
    );
  }

  if (step === 'INVALID') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-gray-500 text-sm">Este link de registro no es válido o ya fue utilizado.</p>
        </div>
      </div>
    );
  }

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Cuenta creada!</h1>
          <p className="text-gray-500 text-sm mb-6">Tu cuenta de tienda fue creada exitosamente.</p>
          <button
            onClick={() => navigate('/tienda-retiro/perfil')}
            className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition text-sm"
          >
            Ir a mi perfil
          </button>
        </div>
      </div>
    );
  }

  const steps: Step[] = ['FORM', 'EMAIL_CODE', 'PHONE_CODE'];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">HeroClash</h1>
          <p className="text-gray-500 mt-1 text-sm">Registro de tienda vendedora</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center gap-2 mb-6">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
                steps.indexOf(step as Step) >= i ? 'bg-primary' : 'bg-gray-200'
              }`} />
            ))}
          </div>

          {step === 'FORM' && (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Datos de la tienda</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de tienda</label>
                <input type="text" value={form.nombreTienda} onChange={set('nombreTienda')} required disabled={loading} placeholder="Ej: Cartas del Sur" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={set('email')} required disabled={loading} placeholder="tienda@ejemplo.com" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar email</label>
                <input
                  type="email" value={form.confirmEmail} onChange={set('confirmEmail')} required disabled={loading} placeholder="Repetí el email"
                  className={`${inputCls} ${form.confirmEmail && form.confirmEmail !== form.email ? 'border-red-300 focus:border-red-400' : ''}`}
                />
                {form.confirmEmail && form.confirmEmail !== form.email && (
                  <p className="text-xs text-red-500 mt-1">Los emails no coinciden</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input type="password" value={form.password} onChange={set('password')} required disabled={loading} placeholder="Mínimo 6 caracteres" className={inputCls} />
                {strength && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                    </div>
                    <p className="text-xs text-gray-400">{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <input
                  type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required disabled={loading} placeholder="Repetí la contraseña"
                  className={`${inputCls} ${form.confirmPassword && form.confirmPassword !== form.password ? 'border-red-300 focus:border-red-400' : ''}`}
                />
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono <span className="text-gray-400 font-normal">(WhatsApp)</span></label>
                <input type="text" value={form.telefono} onChange={set('telefono')} required disabled={loading} placeholder="+54 9 XXXX XXXX" className={inputCls} />
              </div>

              {/* ── UBICACIÓN VÍA GOOGLE MAPS ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Localidad <span className="text-gray-400 font-normal">(Argentina)</span> <span className="text-red-500">*</span>
                </label>
                <CityPicker
                  value={form.ciudad}
                  onChange={({ city, province, center }) => {
                    setForm(prev => ({ ...prev, ciudad: city, provincia: province }));
                    setCityCenter(center);
                  }}
                  disabled={loading}
                />
                {form.provincia && <p className="text-xs text-gray-400 mt-1">{form.provincia}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Dirección exacta en el mapa <span className="text-red-500">*</span>
                </label>
                {!cityCenter && !form.latitud && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                    Seleccioná primero la localidad para centrar el mapa.
                  </p>
                )}
                <GoogleMapPicker
                  value={form.latitud !== null ? {
                    lat: form.latitud,
                    lng: form.longitud!,
                    address: form.direccion,
                    city: form.ciudad,
                    googleMapsUrl: form.googleMapsUrl,
                  } : null}
                  onChange={handleLocationChange}
                  disabled={loading}
                  defaultCenter={cityCenter ?? undefined}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Piso <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input type="text" value={form.piso} onChange={set('piso')} disabled={loading} placeholder="Ej: 2" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Departamento <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input type="text" value={form.departamento} onChange={set('departamento')} disabled={loading} placeholder="Ej: B" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alias <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={form.alias} onChange={set('alias')} disabled={loading} placeholder="Ej: tiendacartas" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CBU <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={form.cbu} onChange={set('cbu')} disabled={loading} placeholder="22 dígitos" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea value={form.descripcion} onChange={set('descripcion')} disabled={loading} rows={3} placeholder="Describí tu tienda..." className={`${inputCls} resize-none`} />
              </div>

              {/* Horarios */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horarios de atención <span className="text-red-500">*</span>
                </label>
                <HorarioGrid
                  value={form.horario}
                  onChange={horario => setForm(prev => ({ ...prev, horario }))}
                />
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

              <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm mt-2">
                Continuar
              </button>
            </form>
          )}

          {step === 'EMAIL_CODE' && (
            <form onSubmit={handleEmailCode} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Verificación de email</h2>
              <p className="text-sm text-gray-500">Ingresá el código enviado a <span className="font-medium text-gray-700">{form.email}</span>.</p>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">En modo testing, el código es siempre <strong>123456</strong>.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de 6 dígitos</label>
                <input
                  type="text" value={emailCode} onChange={e => setEmailCode(e.target.value)}
                  maxLength={6} required disabled={loading} placeholder="123456"
                  className={`${inputCls} tracking-widest text-center text-lg`}
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading || emailCode.length !== 6} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm">
                {loading ? 'Verificando...' : 'Verificar email'}
              </button>
              <button type="button" onClick={() => { setStep('FORM'); setError(null); }} className="w-full text-sm text-gray-400 hover:text-gray-600 mt-1">
                Volver
              </button>
            </form>
          )}

          {step === 'PHONE_CODE' && (
            <form onSubmit={handlePhoneCode} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Verificación de WhatsApp</h2>
              <p className="text-sm text-gray-500">Ingresá el código enviado por WhatsApp a <span className="font-medium text-gray-700">{form.telefono}</span>.</p>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">En modo testing, el código es siempre <strong>123456</strong>.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de 6 dígitos</label>
                <input
                  type="text" value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                  maxLength={6} required disabled={loading} placeholder="123456"
                  className={`${inputCls} tracking-widest text-center text-lg`}
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading || phoneCode.length !== 6} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm">
                {loading ? 'Creando cuenta...' : 'Verificar y crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
