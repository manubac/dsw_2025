import { useState } from "react";
import { Link } from "react-router-dom"; // 👈 importamos Link
import "./LoginPage.css";

export function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login data:", formData);

      // Simulación de login:
  const fakeUser = { nombre: "Nicolás", email: formData.email };
  localStorage.setItem("user", JSON.stringify(fakeUser));

  // Redirigir a /profile
  window.location.href = "/profile";
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Iniciar sesión</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit">Ingresar</button>
        </form>

        {/* 👇 Agregamos esto */}
        <p className="register-link">
          ¿No tenés cuenta?{" "}
          <Link to="/register" className="highlight">
            Registrate acá
          </Link>
        </p>
      </div>
    </div>
  );
}
