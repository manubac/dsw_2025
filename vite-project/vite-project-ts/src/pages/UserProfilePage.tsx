import React, { useState } from "react";
import { useUser } from "../context/user";
import "./UserProfilePage.css";

export function UserProfilePage() {
  const { user, updateUser } = useUser();

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "********",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    console.log("Datos actualizados:", formData);
    updateUser({ name: formData.name, email: formData.email });
    alert("Datos guardados (simulado)");
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

        <button className="save-button" onClick={handleSave}>
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}

