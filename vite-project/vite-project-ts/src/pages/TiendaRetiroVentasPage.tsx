import { useEffect, useState } from "react";
import { useUser } from "../context/user";
import { fetchApi } from "../services/api";

type VentaItem = { cartaNombre: string; cantidad: number; precio: number };
type Vendedor = { nombre: string; alias: string | null; cbu: string | null };
type Venta = {
  id: number;
  estado: string;
  total: number;
  createdAt: string;
  comprador: { nombre: string; email: string };
  vendedores: Vendedor[];
  items: VentaItem[];
};

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
  entregado_a_tienda: { label: "Por llegar", color: "bg-orange-100 text-orange-800" },
  en_tienda: { label: "En tienda", color: "bg-blue-100 text-blue-800" },
  finalizado: { label: "Finalizado", color: "bg-green-100 text-green-800" },
  retirado: { label: "Retirado", color: "bg-green-100 text-green-800" },
};

export default function TiendaRetiroVentasPage() {
  const { user } = useUser();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchVentas = () => {
    if (!user?.id) return;
    fetchApi(`/api/tiendas/${user.id}/ventas`)
      .then((r) => r.json())
      .then((json) => {
        setVentas(json.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Error al cargar las ventas");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchVentas();
  }, [user?.id]);

  const handleMarcarEnTienda = async (ventaId: number) => {
    if (!confirm("¿Confirmás que recibiste este pedido en la tienda?")) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/en-tienda`, { method: "PATCH" });
      fetchVentas();
    } catch {
      alert("Error al actualizar el estado");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalizar = async (ventaId: number) => {
    if (!confirm("¿Confirmás que el comprador retiró el pedido y completó el pago?")) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/finalizar`, { method: "PATCH" });
      fetchVentas();
    } catch {
      alert("Error al finalizar la orden");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando ventas...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (ventas.length === 0)
    return (
      <div className="p-8 text-center text-gray-500">
        No hay ventas asociadas a esta tienda todavía.
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Ventas en mi tienda</h1>
      <div className="space-y-4">
        {ventas.map((venta) => {
          const badge = ESTADO_BADGE[venta.estado] ?? {
            label: venta.estado,
            color: "bg-gray-100 text-gray-700",
          };
          return (
            <div key={venta.id} className="border rounded-xl p-5 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">Compra #{venta.id}</span>
                  <span className="text-sm text-gray-400">
                    {new Date(venta.createdAt).toLocaleDateString("es-AR")}
                  </span>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>
                  {badge.label}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="font-semibold text-gray-600 mb-1">Comprador</p>
                  <p className="text-gray-800">{venta.comprador.nombre}</p>
                  <p className="text-gray-500">{venta.comprador.email}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-600 mb-1">Vendedor(es)</p>
                  {venta.vendedores.length === 0 ? (
                    <p className="text-gray-400 italic">Sin datos</p>
                  ) : (
                    venta.vendedores.map((v, i) => (
                      <div key={i} className="mb-1">
                        <p className="text-gray-800">{v.nombre}</p>
                        {v.alias && (
                          <p className="text-gray-500 text-xs">Alias: {v.alias}</p>
                        )}
                        {v.cbu && (
                          <p className="text-gray-500 text-xs">CBU: {v.cbu}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-600 text-sm mb-2">Artículos</p>
                {venta.items.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Sin detalle de artículos</p>
                ) : (
                  <div className="space-y-1">
                    {venta.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.cartaNombre} × {item.cantidad}
                        </span>
                        <span className="text-gray-600 font-medium">
                          ${item.precio.toLocaleString("es-AR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <span className="font-bold text-gray-900">
                  Total: ${venta.total.toLocaleString("es-AR")}
                </span>

                {venta.estado === "entregado_a_tienda" && (
                  <button
                    disabled={actionLoading === venta.id}
                    onClick={() => handleMarcarEnTienda(venta.id)}
                    className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                  >
                    {actionLoading === venta.id ? "Procesando..." : "Confirmar recepción"}
                  </button>
                )}

                {venta.estado === "en_tienda" && (
                  <button
                    disabled={actionLoading === venta.id}
                    onClick={() => handleFinalizar(venta.id)}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                  >
                    {actionLoading === venta.id ? "Procesando..." : "Finalizar orden"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
