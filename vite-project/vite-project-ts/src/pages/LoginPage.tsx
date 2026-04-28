import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../context/user";
import { fetchApi } from "../services/api";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInstitutional, setShowInstitutional] = useState(false);
  const [institutionalRole, setInstitutionalRole] = useState<"intermediario" | "tiendaRetiro">("intermediario");

  const { login } = useUser();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = showInstitutional
        ? institutionalRole === "intermediario" ? "/api/intermediarios/login" : "/api/tiendas/login"
        : "/api/users/login";

      const response = await fetchApi(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Email o contraseña incorrectos.");
      }

      const data = result.data;
      const role = result.role ?? (showInstitutional ? institutionalRole : "user");

      login(
        {
          id: data.id,
          name: data.username || data.nombre || data.name || "Usuario",
          email: data.email,
          password,
          role,
          is_email_verified: data.is_email_verified,
          is_phone_verified: data.is_phone_verified,
        },
        result.token
      );

      if (role === "tiendaRetiro") navigate("/tienda-retiro/ventas");
      else navigate("/");
    } catch (err: any) {
      setError(err.message || "Ocurrió un error. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / marca */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">HeroClash</h1>
          <p className="text-gray-500 mt-1 text-sm">El marketplace de cartas TCG</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciá sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="vos@ejemplo.com"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              <div className="text-right mt-1">
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>

            {/* Acceso institucional colapsable */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowInstitutional(v => !v)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
              >
                <svg className={`w-3 h-3 transition-transform ${showInstitutional ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                Acceso institucional (intermediarios y tiendas)
              </button>
              {showInstitutional && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInstitutionalRole("intermediario")}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition ${institutionalRole === "intermediario" ? "border-primary bg-primary/10 text-primary font-medium" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  >
                    Intermediario
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstitutionalRole("tiendaRetiro")}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition ${institutionalRole === "tiendaRetiro" ? "border-primary bg-primary/10 text-primary font-medium" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  >
                    Tienda de retiro
                  </button>
                </div>
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
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿No tenés cuenta?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
