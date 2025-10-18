import React, { useState } from "react";
import { useUser } from "../context/user";
import "./UserProfilePage.css";

export function UserProfilePage() {
  const { user, updateUser } = useUser();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "********",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const updateData: any = {
        nombre: formData.name,
        email: formData.email,
      };

      // Only include password if it was changed (not ********)
      if (formData.password !== "********") {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/vendedores/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (response.ok) {
        // Update local state
        updateUser({ 
          name: formData.name, 
          email: formData.email,
          ...(formData.password !== "********" && { password: formData.password })
        });
        // Reset password field to masked
        setFormData(prev => ({ ...prev, password: "********" }));
        alert("Datos actualizados exitosamente");
      } else {
        alert("Error al actualizar: " + (result.message || "Error desconocido"));
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Error al actualizar el perfil");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-wrapper">
        <div className="profile-card">
          <h2>No has iniciado sesión</h2>
          <p>Por favor, inicia sesión para ver tu perfil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-wrapper">
      <div className="profile-card">
        <h2>Mi Perfil</h2>

        <div className="form-group">
          <label htmlFor="name">Nombre</label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />
        </div>

        <button className="save-button" onClick={handleSave} disabled={loading}>
          {loading ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </div>
  );
}

