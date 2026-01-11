import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import './UserRegistration.css';

export function UserRegistration() {
  const navigate = useNavigate();
  const { login } = useUser();
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      let endpoint = '';
      let requestData: Record<string, any> = {};

  // ================================
  // REGISTRO DE VENDEDOR
  // ================================
      if (formData.rol === 'vendedor') {
        endpoint = '/api/vendedores';
        requestData = {
          nombre: formData.nombre,
          email: formData.email,
          password: formData.password,
          telefono: formData.telefono,
          ciudad: formData.ciudad,
          provincia: formData.provincia,
          pais: formData.pais,
          codigoPostal: formData.codigoPostal,
        };
      }

  // ================================
  // REGISTRO DE USUARIO NORMAL
  // ================================
      else if (formData.rol === 'usuario') {
        endpoint = '/api/users';
        requestData = {
          username: formData.nombre,
          email: formData.email,
          password: formData.password,
          role: formData.rol,
        };
      }

  // ================================
  // REGISTRO DE INTERMEDIARIO
  // ================================
      else if (formData.rol === 'intermediario') {
        endpoint = '/api/intermediarios';
        requestData = {
          nombre: formData.nombre,
          email: formData.email,
          password: formData.password,
          telefono: formData.telefono,
          descripcion: formData.ciudad, // Using ciudad as description for now
          activo: true,
        };
      }

  // ================================
  // Enviar request al backend
  // ================================
      console.log('Sending registration to:', endpoint, requestData);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Backend error response:', result);
        throw new Error(result.error || result.message || 'Error al crear el usuario.');
      }

      setSuccess('¡Cuenta creada con éxito!');

  // ================================
  // Login automático
  // ================================
      const loginEndpoint =
        formData.rol === 'vendedor' ? '/api/vendedores/login' :
        formData.rol === 'intermediario' ? '/api/intermediarios/login' :
        '/api/users/login';

      const loginResponse = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const loginResult = await loginResponse.json();
      if (!loginResponse.ok) {
        console.error('Auto-login failed:', loginResult);
        navigate('/login');
        return;
      }

      const userData = {
        id: loginResult.data.id,
        name: loginResult.data.username || loginResult.data.nombre,
        email: loginResult.data.email,
        password: formData.password,
        role: loginResult.data.role || formData.rol,
      };

      login(userData);
      navigate('/profile');
    } catch (error: any) {
      console.error('Error creating user:', error);
      setError(error.message);
    }
  };

  return (
    <div className="form-wrapper">
      <div className="form-card">
        <h1>Crear Cuenta</h1>
        <p className="subtitle">Únete al marketplace de cartas Pokémon</p>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre">Nombre completo</label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
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
            />
          </div>

          <div className="form-group">
            <label htmlFor="telefono">Número de teléfono</label>
            <input
              type="tel"
              id="telefono"
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rol">Tipo de usuario</label>
            <select
              id="rol"
              name="rol"
              value={formData.rol}
              onChange={handleChange}
              required
            >
              <option value="usuario">Usuario regular</option>
              <option value="vendedor">Vendedor</option>
              <option value="intermediario">Intermediario</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="ciudad">Ciudad</label>
              <input
                type="text"
                id="ciudad"
                name="ciudad"
                value={formData.ciudad}
                onChange={handleChange}
              />
            </div>
            <div className="form-group half">
              <label htmlFor="provincia">Provincia</label>
              <input
                type="text"
                id="provincia"
                name="provincia"
                value={formData.provincia}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="pais">País</label>
              <input
                type="text"
                id="pais"
                name="pais"
                value={formData.pais}
                onChange={handleChange}
              />
            </div>
            <div className="form-group half">
              <label htmlFor="codigoPostal">Código Postal</label>
              <input
                type="text"
                id="codigoPostal"
                name="codigoPostal"
                value={formData.codigoPostal}
                onChange={handleChange}
              />
            </div>
          </div>

          <button type="submit">Crear cuenta</button>
        </form>
      </div>
    </div>
  );
}
