import { Link } from "react-router-dom";

export default function PagoPendiente() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-3xl font-bold text-yellow-500 mb-4">
        ⏳ Pago pendiente
      </h1>

      <p className="text-gray-600 mb-6">
        Tu pago está siendo procesado por MercadoPago.
        Te avisaremos cuando se confirme.
      </p>

      <Link
        to="/purchases"
        className="bg-primary text-white px-6 py-3 rounded-xl hover:opacity-90 transition"
      >
        Ver mis compras
      </Link>
    </div>
  );
}