import { useState } from 'react';
import './UserRegistration.css';

export function UserRegistration() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    telefono: '',
    rol: 'usuario',
    ciudad: '',
    provincia: '',
    pais: '',
    codigoPostal: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form data submitted:', formData);
  };

  return (
    <div className="form-wrapper">
      <div className="form-card">
        <h1>Crear Cuenta</h1>
        <p className="subtitle">Únete al marketplace de cartas Pokémon</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre">Nombre completo</label>
            <input type="text" id="nombre" name="nombre" value={formData.nombre} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="telefono">Número de teléfono</label>
            <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label htmlFor="rol">Tipo de usuario</label>
            <select id="rol" name="rol" value={formData.rol} onChange={handleChange} required>
              <option value="usuario">Usuario regular</option>
              <option value="vendedor">Vendedor</option>
              <option value="intermediario">Intermediario</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="ciudad">Ciudad</label>
              <input type="text" id="ciudad" name="ciudad" value={formData.ciudad} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label htmlFor="provincia">Provincia</label>
              <input type="text" id="provincia" name="provincia" value={formData.provincia} onChange={handleChange} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="pais">País</label>
              <input type="text" id="pais" name="pais" value={formData.pais} onChange={handleChange} />
            </div>
            <div className="form-group half">
              <label htmlFor="codigoPostal">Código Postal</label>
              <input type="text" id="codigoPostal" name="codigoPostal" value={formData.codigoPostal} onChange={handleChange} />
            </div>
          </div>

          <button type="submit">Crear cuenta</button>
        </form>
      </div>
    </div>
  );
}
