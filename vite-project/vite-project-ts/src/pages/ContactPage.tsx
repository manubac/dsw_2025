import React, { useState } from "react";
import { fetchApi } from "../services/api";

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
      const response = await fetchApi('/api/contact', {
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
  <div className="min-h-screen bg-green-50 py-10 px-4">
    <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-green-200">
      
      {/* Título */}
      <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-orange-500 to-orange-700 bg-clip-text text-transparent tracking-tight">
        Contacto
      </h1>

      <div className="w-20 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded mb-6"></div>

      <p className="text-orange-500 mb-8">
        ¿Tienes alguna pregunta o necesitas ayuda? ¡Estamos aquí para ayudarte!
        Envíanos un mensaje y te responderemos lo antes posible.
      </p>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Info */}
        <div>
          <h2 className="text-xl font-semibold text-orange-600 mb-4">
            Información de Contacto
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-orange-500">Email</h3>
              <p className="text-gray-700">soporte@pokemoncard.com</p>
            </div>

            <div>
              <h3 className="font-semibold text-orange-500">Teléfono</h3>
              <p className="text-gray-700">+54 11 1234-5678</p>
            </div>

            <div>
              <h3 className="font-semibold text-orange-500">
                Horarios de Atención
              </h3>
              <p className="text-gray-700">Lunes a Viernes: 9:00 - 18:00</p>
              <p className="text-gray-700">Sábados: 10:00 - 16:00</p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <div>
          <h2 className="text-xl font-semibold text-orange-600 mb-4">
            Envíanos un Mensaje
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-black font-semibold mb-1">
                Nombre *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-black font-semibold mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-black font-semibold mb-1">
                Asunto *
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-black font-semibold mb-1">
                Mensaje *
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows={6}
                required
                className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold py-2 px-4 rounded-lg transition shadow-md hover:shadow-lg"
            >
              {loading ? "Enviando..." : "Enviar Mensaje"}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
);
}