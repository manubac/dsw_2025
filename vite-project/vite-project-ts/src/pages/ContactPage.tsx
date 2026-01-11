import React, { useState } from "react";
import "./ContactPage.css";

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("¡Mensaje enviado exitosamente! Te responderemos pronto.");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        const errorData = await response.json();
        alert(`Error al enviar el mensaje: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert("Error al enviar el mensaje. Por favor intenta nuevamente más tarde.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="contact-wrapper">
      <div className="contact-container">
        <h1>Contacto</h1>
        <p className="contact-intro">
          ¿Tienes alguna pregunta o necesitas ayuda? ¡Estamos aquí para ayudarte!
          Envíanos un mensaje y te responderemos lo antes posible.
        </p>

        <div className="contact-content">
          <div className="contact-info">
            <h2>Información de Contacto</h2>
            <div className="info-item">
              <h3>Email</h3>
              <p>soporte@pokemoncard.com</p>
            </div>
            <div className="info-item">
              <h3>Teléfono</h3>
              <p>+54 11 1234-5678</p>
            </div>
            <div className="info-item">
              <h3>Horarios de Atención</h3>
              <p>Lunes a Viernes: 9:00 - 18:00</p>
              <p>Sábados: 10:00 - 16:00</p>
            </div>
          </div>

          <div className="contact-form">
            <h2>Envíanos un Mensaje</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Nombre *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
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
                <label htmlFor="subject">Asunto *</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Mensaje *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  required
                />
              </div>

              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? "Enviando..." : "Enviar Mensaje"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}