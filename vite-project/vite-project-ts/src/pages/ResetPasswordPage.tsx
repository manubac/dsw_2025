import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import './LoginPage.css';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
    }
    if (!token) {
        setError('Token inválido o faltante.');
        return;
    }

    setLoading(true);
    setError('');

    try {
        await api.post('/api/users/reset-password', { 
          token, 
          newPassword: password 
      });
      setMessage('Contraseña actualizada con éxito. Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
      return (
          <div className="login-container">
            <div className="login-card">
              <h2>Error</h2>
              <p>Token de recuperación no válido.</p>
              <Link to="/forgot-password">Solicitar nuevo enlace</Link>
            </div>
          </div>
      )
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Restablecer Contraseña</h2>
        
        {message && <div className="alert success" style={{color: 'green', background: '#d1fae5', padding: '10px'}}>{message}</div>}
        {error && <div className="alert error" style={{color: 'red', background: '#fee2e2', padding: '10px'}}>{error}</div>}

        {!message && (
            <form onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="password">Nueva Contraseña</label>
                <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                />
            </div>
            <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                />
            </div>

            <button type="submit" disabled={loading} className="login-btn">
                {loading ? 'Restableciendo...' : 'Guardar Nueva Contraseña'}
            </button>
            </form>
        )}
      </div>
    </div>
  );
}
