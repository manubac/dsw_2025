import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useUser } from "../context/user";
import "./LoginPage.css";

export function LoginPage() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useUser(); //  del contexto global

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await axios.post("http://localhost:3000/api/vendedores/login", formData);
      const userData = response.data.data;

      //  Guardamos en contexto + localStorage
      login(userData);
      localStorage.setItem("user", JSON.stringify(userData));

      navigate("/profile");
    } catch (err: any) {
      setError("Email o contraseña incorrecto");
      console.error(err);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1>Iniciar sesión</h1>

        {error && <p className="error-text">{error}</p>}

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
