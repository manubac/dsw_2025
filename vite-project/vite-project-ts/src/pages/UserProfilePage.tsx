import React, { useState } from "react";
import "./UserProfilePage.css";

export function UserProfilePage() {
  const [user, setUser] = useState({
    name: "Nicolás",
    email: "nico@example.com",
    password: "********",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUser(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    console.log("Datos actualizados:", user);
    alert("Datos guardados (simulado)");
  };

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
            value={user.name}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={user.email}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            name="password"
            value={user.password}
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
