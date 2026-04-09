import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/user";
import { fetchApi } from "../services/api";

export function PagoExitoso() {
  const navigate = useNavigate();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("Confirmando pago...");

  useEffect(() => {
    const confirmarCompra = async () => {
      try {
        // ==========================
        // 1) Validar usuario
        // ==========================
        if (!user?.id) {
          setMensaje("Usuario no identificado");
          setLoading(false);
          return;
        }

        // ==========================
        // 2) Leer params de MP
        // ==========================
        const params = new URLSearchParams(window.location.search);
        const status = params.get("status");

        if (status !== "approved") {
          setMensaje("El pago no fue aprobado.");
          setLoading(false);
          return;
        }

        // ==========================
        // 3) Buscar última compra
        // ==========================
        const res = await fetchApi(
          `/api/compras?compradorId=${user.id}`
        );

        const json = await res.json();

        if (!json.data || json.data.length === 0) {
          setMensaje("No se encontró la compra.");
          setLoading(false);
          return;
        }

        const ultimaCompra = json.data.at(-1);

        // ==========================
        // 4) Marcar como pagada
        // ==========================
        await fetchApi(`/api/compras/${ultimaCompra.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado: "pagado",
          }),
        });

        setMensaje("¡Pago confirmado correctamente!");
      } catch (error) {
        console.error(error);
        setMensaje("Error confirmando el pago.");
      } finally {
        setLoading(false);
      }
    };

    confirmarCompra();
  }, [user]);

  // ==========================
  // UI
  // ==========================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 max-w-md w-full text-center">

        {loading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-white">
              {mensaje}
            </h2>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">✅</div>

            <h1 className="text-2xl font-bold text-green-600 mb-2">
              Pago exitoso
            </h1>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {mensaje}
            </p>

            <button
              onClick={() => navigate("/")}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition"
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </div>
  );
}