import { Link } from "react-router-dom";

export default function PagoError() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-3xl font-bold text-red-600 mb-4">
        ❌ El pago fue rechazado
      </h1>

      <p className="text-gray-600 mb-6">
        Hubo un problema al procesar el pago.
        Podés intentarlo nuevamente.
      </p>

      <Link
        to="/checkout"
        className="bg-primary text-white px-6 py-3 rounded-xl hover:opacity-90 transition"
      >
        Volver al checkout
      </Link>
    </div>
  );
}