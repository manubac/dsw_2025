import React, { useState, useEffect } from "react";
import { useUser, Direccion } from "../context/user";
import "./UserProfilePage.css";
import { fetchApi } from "../services/api";

/**
 * Página de perfil del usuario.
 * Permite editar datos básicos según el tipo de cuenta (usuario, vendedor o intermediario).
 * Soporta actualización condicional del endpoint de acuerdo al rol.
 */

export function UserProfilePage() {
  const { user, updateUser, logout, addDireccion, removeDireccion, loadDirecciones } = useUser();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "********",
  });

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estado para direcciones
  const [showDireccionForm, setShowDireccionForm] = useState(false);
  const [editingDireccion, setEditingDireccion] = useState<Direccion | null>(null);
  const [direccionForm, setDireccionForm] = useState({
    provincia: "",
    ciudad: "",
    codigoPostal: "",
    calle: "",
    altura: "",
    departamento: "",
  });

  // Cargar direcciones al montar el componente
  useEffect(() => {
    if (user?.id) {
      loadDirecciones();
    }
  }, [user?.id, loadDirecciones]);

  // Manejar cambios en el formulario de dirección
  const handleDireccionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDireccionForm((prev) => ({ ...prev, [name]: value }));
  };

  // Guardar nueva dirección
  const handleSaveDireccion = async () => {
    if (!user?.id) return;

    try {
      const requestBody = {
        ...direccionForm,
        ...(user.role === 'intermediario' ? { intermediarioId: user.id } : { usuarioId: user.id }),
      };

      const response = await fetchApi('/api/direcciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const nuevaDireccion = await response.json();
        addDireccion(nuevaDireccion.data);
        setDireccionForm({
          provincia: "",
          ciudad: "",
          codigoPostal: "",
          calle: "",
          altura: "",
          departamento: "",
        });
        setShowDireccionForm(false);
        setMessage("Dirección agregada exitosamente.");
      } else {
        const error = await response.json();
        setError(error.message || "Error al agregar dirección.");
      }
    } catch (err: any) {
      setError("Error al agregar dirección.");
    }
  };

  // Editar dirección existente
  const handleEditDireccion = (direccion: Direccion) => {
    setEditingDireccion(direccion);
    setDireccionForm({
      provincia: direccion.provincia,
      ciudad: direccion.ciudad,
      codigoPostal: direccion.codigoPostal,
      calle: direccion.calle,
      altura: direccion.altura,
      departamento: direccion.departamento || "",
    });
    setShowDireccionForm(true);
  };

  // Actualizar dirección
  const handleUpdateDireccion = async () => {
    if (!user?.id || !editingDireccion) return;

    try {
      const queryParam = user.role === 'intermediario' ? 'intermediarioId' : 'usuarioId';
      const response = await fetchApi(`/api/direcciones/${editingDireccion.id}?${queryParam}=${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(direccionForm),
      });

      if (response.ok) {
        const updatedDireccion = await response.json();
        // Update the direccion in the user context
        const updatedDirecciones = user.direcciones?.map(d => 
          d.id === editingDireccion.id ? updatedDireccion.data : d
        ) || [];
        updateUser({ direcciones: updatedDirecciones });
        setMessage("Dirección actualizada exitosamente.");
        setShowDireccionForm(false);
        setEditingDireccion(null);
        setDireccionForm({
          provincia: "",
          ciudad: "",
          codigoPostal: "",
          calle: "",
          altura: "",
          departamento: "",
        });
      } else {
        const error = await response.json();
        setError(error.message || "Error al actualizar dirección.");
      }
    } catch (err: any) {
      setError("Error al actualizar dirección.");
    }
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setShowDireccionForm(false);
    setEditingDireccion(null);
    setDireccionForm({
      provincia: "",
      ciudad: "",
      codigoPostal: "",
      calle: "",
      altura: "",
      departamento: "",
    });
  };

  // Eliminar dirección
  const handleDeleteDireccion = async (id: number) => {
    if (!confirm("¿Seguro que querés eliminar esta dirección?")) return;

    try {
      const queryParam = user?.role === 'intermediario' ? 'intermediarioId' : 'usuarioId';
      const response = await fetchApi(`/api/direcciones/${id}?${queryParam}=${user?.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        removeDireccion(id);
        setMessage("Dirección eliminada exitosamente.");
      } else {
        setError("Error al eliminar dirección.");
      }
    } catch (err: any) {
      setError("Error al eliminar dirección.");
    }
  };

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

      // controlador backend que expone `/api/users`.
      switch (user.role) {
        case "vendedor":
          endpoint = `/api/vendedores/${user.id}`;
          break;
        case "usuario":
          endpoint = `/api/users/${user.id}`;
          break;
        case "intermediario":
          endpoint = `/api/intermediarios/${user.id}`;
          break;
        default:
          throw new Error("Rol de usuario desconocido o no configurado.");
      }

      // El backend de vendedores espera campos con nombre/telefono/etc.
      // El backend de usuarios espera `username` en lugar de `nombre`.
      // El backend de intermediarios espera nombre/telefono/etc.
      const updateData: Record<string, any> =
        user.role === "vendedor" || user.role === "intermediario"
          ? { nombre: formData.name, email: formData.email }
          : { username: formData.name, email: formData.email };

      // Solo incluir contraseña si se modificó
      if (formData.password !== "********" && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }

      const response = await fetchApi(endpoint, {
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

  setMessage("Datos actualizados exitosamente.");
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

      {/* Sección de Direcciones */}
      <div className="profile-card">
        <h3>Mis Direcciones</h3>
        
        {user?.direcciones && user.direcciones.length > 0 ? (
          <div className="direcciones-list">
            {user.direcciones.map((direccion) => (
              <div key={direccion.id} className="direccion-item">
                <div className="direccion-info">
                  <p>{direccion.calle} {direccion.altura}{direccion.departamento && `, ${direccion.departamento}`}</p>
                  <p>{direccion.ciudad}, {direccion.provincia} - CP: {direccion.codigoPostal}</p>
                </div>
                <div className="direccion-actions">
                  <button 
                    className="edit-direccion-btn"
                    onClick={() => handleEditDireccion(direccion)}
                  >
                    Editar
                  </button>
                  <button 
                    className="delete-direccion-btn"
                    onClick={() => handleDeleteDireccion(direccion.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No tienes direcciones registradas.</p>
        )}

        {!showDireccionForm ? (
          <button 
            className="add-direccion-btn"
            onClick={() => setShowDireccionForm(true)}
          >
            Agregar Nueva Dirección
          </button>
        ) : (
          <div className="direccion-form">
            <h4>{editingDireccion ? 'Editar Dirección' : 'Nueva Dirección'}</h4>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="provincia">Provincia</label>
                <input
                  id="provincia"
                  type="text"
                  name="provincia"
                  value={direccionForm.provincia}
                  onChange={handleDireccionChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="ciudad">Ciudad</label>
                <input
                  id="ciudad"
                  type="text"
                  name="ciudad"
                  value={direccionForm.ciudad}
                  onChange={handleDireccionChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="codigoPostal">Código Postal</label>
                <input
                  id="codigoPostal"
                  type="text"
                  name="codigoPostal"
                  value={direccionForm.codigoPostal}
                  onChange={handleDireccionChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="calle">Calle</label>
                <input
                  id="calle"
                  type="text"
                  name="calle"
                  value={direccionForm.calle}
                  onChange={handleDireccionChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="altura">Altura</label>
                <input
                  id="altura"
                  type="text"
                  name="altura"
                  value={direccionForm.altura}
                  onChange={handleDireccionChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="departamento">Departamento (opcional)</label>
                <input
                  id="departamento"
                  type="text"
                  name="departamento"
                  value={direccionForm.departamento}
                  onChange={handleDireccionChange}
                />
              </div>
            </div>

            <div className="direccion-actions">
              <button 
                className="save-direccion-btn"
                onClick={editingDireccion ? handleUpdateDireccion : handleSaveDireccion}
              >
                {editingDireccion ? 'Actualizar Dirección' : 'Guardar Dirección'}
              </button>
              
              <button 
                className="cancel-direccion-btn"
                onClick={handleCancelEdit}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
