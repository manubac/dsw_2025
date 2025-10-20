import React, { useState } from "react";
import { useUser } from "../context/user";
import "./UserProfilePage.css";

/**
 * Página de perfil del usuario.
 * Permite editar datos básicos según el tipo de cuenta (usuario, vendedor o intermediario).
 * Soporta actualización condicional del endpoint de acuerdo al rol.
 */

export function UserProfilePage() {
  const { user, updateUser, logout } = useUser();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "********",
  });

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Guarda los cambios del perfil según el rol del usuario.
   * Si el rol es "vendedor", se usa /api/vendedores/:id
   * Si es "usuario", se usa /api/usuarios/:id
   * Si es "intermediario", se usa /api/intermediarios/:id
   */
  const handleSave = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      let endpoint = "";

      switch (user.role) {
        case "vendedor":
          endpoint = `/api/vendedores/${user.id}`;
          break;
        case "usuario":
          endpoint = `/api/usuarios/${user.id}`;
          break;
        case "intermediario":
          endpoint = `/api/intermediarios/${user.id}`;
          break;
        default:
          throw new Error("Rol de usuario desconocido o no configurado.");
      }

      const updateData: Record<string, any> = {
        nombre: formData.name,
        email: formData.email,
      };

      // Solo incluir contraseña si se modificó
      if (formData.password !== "********" && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();
      console.log("Respuesta de actualización:", result);

      if (!response.ok) {
        const backendMsg = result.message || "Error al actualizar los datos.";
        throw new Error(backendMsg);
      }

      // Actualizamos los datos en el contexto global
      updateUser({
        name: formData.name,
        email: formData.email,
        ...(formData.password !== "********" && { password: formData.password }),
      });

      setMessage("✅ Datos actualizados exitosamente.");
      setFormData((prev) => ({ ...prev, password: "********" }));
    } catch (err: any) {
      console.error("Error en actualización:", err);
      setError(err.message || "Error al actualizar el perfil.");
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const handleLogout = () => {
    if (confirm("¿Seguro que querés cerrar sesión?")) {
      logout();
      window.location.href = "/login";
    }
  };

  // Caso: no hay usuario logueado
  if (!user) {
    return (
      <div className="profile-wrapper">
        <div className="profile-card">
          <h2>No has iniciado sesión</h2>
          <p>Por favor, inicia sesión para ver y editar tu perfil.</p>
          <a href="/login" className="btn-primary">
            Ir al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  // Render principal del perfil
  return (
    <div className="profile-wrapper">
      <div className="profile-card">
        <h2>Mi Perfil</h2>
        <p className="profile-subtitle">
          Rol actual: <strong>{user.role?.toUpperCase()}</strong>
        </p>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        {/* Campo: Nombre */}
        <div className="form-group">
          <label htmlFor="name">Nombre</label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        {/* Campo: Email */}
        <div className="form-group">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        {/* Campo: Contraseña */}
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            disabled={loading}
          />
          <small className="hint">
            Dejá este campo sin cambios si no querés actualizar tu contraseña.
          </small>
        </div>

        {/* Botones de acción */}
        <div className="profile-actions">
          <button
            className="save-button"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar Cambios"}
          </button>

          <button
            className="logout-button"
            onClick={handleLogout}
            disabled={loading}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
