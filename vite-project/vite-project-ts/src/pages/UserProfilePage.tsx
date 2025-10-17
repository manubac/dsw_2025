import React, { useState, useEffect } from "react";
import "./UserProfilePage.css";
import { useUser } from "../context/user"; // Importamos el contexto

export function UserProfilePage() {
  const { user, updateUser } = useUser(); // obtenemos el usuario actual y la función para actualizarlo
  const [localUser, setLocalUser] = useState({
    name: "",
    email: "",
    password: "",
  });

  // cuando el usuario esté disponible en el contexto, lo copiamos al estado local
  useEffect(() => {
    if (user) {
      setLocalUser({
        name: user.name,
        email: user.email,
        password: user.password || "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    updateUser(localUser); // actualiza en el contexto global
    alert("Datos guardados (simulado)");
    console.log("Datos actualizados:", localUser);
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
            value={localUser.name}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={localUser.email}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            name="password"
            value={localUser.password}
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

