import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './LoginPage.css'; // Reusing login styles

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await axios.post('http://localhost:3000/api/users/forgot-password', { email });
      setMessage('Si el correo existe, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (y spam).');
    } catch (err: any) {
      setError('Error al procesar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Recuperar Contraseña</h2>
        <p>Ingresa tu email para recibir un enlace de recuperación.</p>
        
        {message && <div className="alert success" style={{color: 'green', background: '#d1fae5', padding: '10px'}}>{message}</div>}
        {error && <div className="alert error" style={{color: 'red', background: '#fee2e2', padding: '10px'}}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? 'Enviando...' : 'Enviar Enlace'}
          </button>
        </form>

        <div className="login-footer">
          <p>
            <Link to="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
