import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../context/user";
import "./LoginPage.css";



export function LoginPage() {
  // Estado local del formulario
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rol: "vendedor", // valor por defecto
  });

  // Estados de control de UI
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Contexto global de usuario
  const { login } = useUser();

  // Navegación de React Router
  const navigate = useNavigate();

  // Manejar cambios en los campos del formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Seleccionar endpoint según el tipo de usuario
      let endpoint = "";
      if (formData.rol === "vendedor") {
        endpoint = "/api/vendedores/login";
      } else if (formData.rol === "usuario") {
        endpoint = "/api/users/login";
      } else if (formData.rol === "intermediario") {
        endpoint = "/api/intermediarios/login";
      } else {
        throw new Error("Rol de usuario no válido.");
      }

      console.log("Iniciando sesión en:", endpoint);

      // Hacer petición al backend
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const result = await response.json();
      console.log("Respuesta del backend:", result);

      if (!response.ok) {
        // Manejo de errores de backend
        const errorMessage = result.message || "Error al iniciar sesión. Verifique sus datos.";
        throw new Error(errorMessage);
      }

      // Login exitoso
      const userData = {
        id: result.data.id,
        name: result.data.username || result.data.nombre || result.data.name || "Usuario",
        email: result.data.email,
        password: formData.password, // Guardamos solo temporalmente en contexto
        role: formData.rol,
      };

      // Guardar usuario en el contexto global
      login(userData, result.token);

      setSuccess("¡Inicio de sesión exitoso! Redirigiendo...");
      console.log("Usuario logueado:", userData);

      // Redirigir después de un breve delay
      setTimeout(() => {
        navigate("/");
      }, 1200);
    } catch (error: any) {
      console.error("Error en login:", error);
      setError(error.message || "Ocurrió un error al intentar iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Iniciar sesión</h1>
        <p className="subtitle">Accedé a tu cuenta para publicar, comprar o gestionar tus cartas</p>

        {/* Mensajes de estado */}
        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        {/* Formulario principal */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Ej: entrenador@pokemon.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Tu contraseña"
            />
          </div>

          <div className="form-group">
            <label htmlFor="rol">Tipo de usuario</label>
            <select
              id="rol"
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              disabled={loading}
              required
            >
              <option value="vendedor">Vendedor</option>
              <option value="usuario">Usuario regular</option>
              <option value="intermediario">Intermediario</option>
            </select>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* Enlace a registro */}
        <p className="register-link">
          ¿No tenés cuenta?{" "}
          <Link to="/register" className="highlight">
            Registrate acá
          </Link>
        </p>

        {/* Enlace a recuperación de contraseña (futuro) */}
        <p className="forgot-link">
          ¿Olvidaste tu contraseña?{" "}
          <Link to="/recover" className="highlight">
            Recuperala acá
          </Link>
        </p>
      </div>
    </div>
  );
}
