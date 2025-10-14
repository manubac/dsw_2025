import { useState, useEffect } from 'react';
import './UserRegistration.css';

interface VendedorClass {
  id: string;
  name: string;
  // Add other properties of VendedorClass if needed
}

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
    vendedorClass: '', // New state for vendedor class
  });

  const [vendedorClasses, setVendedorClasses] = useState<VendedorClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (formData.rol === 'vendedor') {
      fetch('/api/vendedores/classes')
        .then(res => {
          if (!res.ok) {
            throw new Error('Network response was not ok');
          }
          return res.json();
        })
        .then(data => {
            if (Array.isArray(data.data)) {
                setVendedorClasses(data.data);
            } else {
                console.error("Expected data.data to be an array, but got:", data.data);
                setVendedorClasses([]);
            }
        })
        .catch(error => {
          console.error('Error fetching vendedor classes:', error);
          setError('No se pudieron cargar las clases de vendedor. Por favor, asegúrese de que el backend esté funcionando y que haya clases de vendedor creadas.');
        });
    }
  }, [formData.rol]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (formData.rol === 'vendedor') {
      // Ensure a vendedor class is selected
      if (!formData.vendedorClass) {
        setError('Por favor, seleccione una clase de vendedor.');
        return;
      }

      try {
        const requestData = {
          nombre: formData.nombre,
          email: formData.email,
          password: formData.password,
          telefono: formData.telefono,
          vendedorClass: formData.vendedorClass, // Pass the ID
          // Add other fields as required by your backend
        };
        
        console.log('Sending request data:', requestData);
        
        const response = await fetch('/api/vendedores', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        });

        const result = await response.json();

        if (!response.ok) {
          // Handle validation errors or other server errors
          console.log('Backend error response:', result);
          const errorMessage = result.error || result.message || 'Ocurrió un error al crear el vendedor.';
          throw new Error(errorMessage);
        }

        setSuccess('¡Vendedor creado con éxito!');
        console.log('Vendedor created:', result);
        // Optionally, redirect the user or clear the form
      } catch (error: any) {
        console.error('Error creating vendedor:', error);
        setError(error.message);
      }
    } else {
      // Handle registration for other user types
      console.log('Form data submitted for other user type:', formData);
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

          {formData.rol === 'vendedor' && (
            <div className="form-group">
              <label htmlFor="vendedorClass">Clase de Vendedor</label>
              <select id="vendedorClass" name="vendedorClass" value={formData.vendedorClass} onChange={handleChange} required>
                <option value="">Seleccione una clase</option>
                {vendedorClasses.map((vc) => (
                  <option key={vc.id} value={vc.id}>{vc.name}</option>
                ))}
              </select>
              {vendedorClasses.length === 0 && <small>No hay clases de vendedor disponibles. Cree una primero en el backend.</small>}
            </div>
          )}

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
