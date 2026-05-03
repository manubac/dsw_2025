import { orm } from '../shared/db/orm.js';
import { Notificacion } from './notificacion.entity.js';
import { Compra } from '../compra/compra.entity.js';
import { io } from '../socket/index.js';

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_tienda: 'En tienda',
  pago_confirmado: 'Pago confirmado',
  listo_para_retirar: 'Listo para retirar',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

interface NotifTarget {
  userId: number;
  userRole: 'user' | 'vendedor' | 'tiendaRetiro';
  contexto: 'compra' | 'venta' | 'gestion' | undefined;
  texto: string;
}

async function loadCompraConActores(compraId: number): Promise<Compra | null> {
  const em = orm.em.fork();
  return em.findOne(Compra, { id: compraId }, {
    populate: [
      'comprador',
      'compradorTienda',
      'itemCartas',
      'itemCartas.uploaderVendedor',
      'itemCartas.uploaderVendedor.user',
      'itemCartas.uploaderTienda',
      'tiendaRetiro',
    ] as any,
  });
}

function resolveTargetsEstado(compra: Compra, nuevoEstado: string, estadoLabel: string): NotifTarget[] {
  const compraId = compra.id!;
  const targets: NotifTarget[] = [];
  const hasTiendaRetiro = !!(compra.tiendaRetiro as any)?.id;

  // ── Comprador ──────────────────────────────────────────────────────────
  // Con tienda de retiro: en_tienda / pago_confirmado / finalizado / cancelado
  // Sin tienda de retiro o compra directa a tienda: finalizado / cancelado
  const compradorStates = hasTiendaRetiro
    ? ['en_tienda', 'pago_confirmado', 'finalizado', 'cancelado']
    : ['finalizado', 'cancelado'];

  if (compradorStates.includes(nuevoEstado)) {
    if ((compra.comprador as any)?.id) {
      targets.push({
        userId: (compra.comprador as any).id,
        userRole: 'user',
        contexto: undefined,
        texto: `Tu orden #${compraId} pasó a: ${estadoLabel}`,
      });
    }
    if ((compra.compradorTienda as any)?.id) {
      targets.push({
        userId: (compra.compradorTienda as any).id,
        userRole: 'tiendaRetiro',
        contexto: 'compra',
        texto: `Tu compra #${compraId} pasó a: ${estadoLabel}`,
      });
    }
  }

  // ── Vendedor ──────────────────────────────────────────────────────────
  // Con tienda de retiro: en_tienda / finalizado / cancelado
  // Sin tienda de retiro: solo cancelado
  const vendedorStates = hasTiendaRetiro
    ? ['en_tienda', 'finalizado', 'cancelado']
    : ['cancelado'];

  if (vendedorStates.includes(nuevoEstado)) {
    const vendedoresYa = new Set<number>();
    for (const item of compra.itemCartas.getItems()) {
      const v = (item as any).uploaderVendedor;
      if (v?.id && v.user?.id && !vendedoresYa.has(v.id)) {
        vendedoresYa.add(v.id);
        targets.push({
          userId: v.user.id,
          userRole: 'vendedor',
          contexto: 'venta',
          texto: `Tu venta #${compraId} pasó a: ${estadoLabel}`,
        });
      }
    }
  }

  // ── Tienda como vendedor directo (uploaderTienda) ─────────────────────
  // Solo finalizado / cancelado
  if (['finalizado', 'cancelado'].includes(nuevoEstado)) {
    const tiendasVentaYa = new Set<number>();
    for (const item of compra.itemCartas.getItems()) {
      const t = (item as any).uploaderTienda;
      if (t?.id && !tiendasVentaYa.has(t.id)) {
        tiendasVentaYa.add(t.id);
        targets.push({
          userId: t.id,
          userRole: 'tiendaRetiro',
          contexto: 'venta',
          texto: `Tu venta #${compraId} pasó a: ${estadoLabel}`,
        });
      }
    }
  }

  // ── TiendaRetiro como gestión ─────────────────────────────────────────
  // pendiente (orden nueva) / pago_confirmado / cancelado
  if (['pendiente', 'pago_confirmado', 'cancelado'].includes(nuevoEstado) && hasTiendaRetiro) {
    targets.push({
      userId: (compra.tiendaRetiro as any).id,
      userRole: 'tiendaRetiro',
      contexto: 'gestion',
      texto: nuevoEstado === 'pendiente'
        ? `Nueva orden #${compraId} asignada a tu tienda`
        : `Pedido #${compraId} (gestión) pasó a: ${estadoLabel}`,
    });
  }

  return targets;
}

function resolveTargetsMensaje(compra: Compra, senderRole: string, senderId: number): NotifTarget[] {
  const compraId = compra.id!;
  const texto = `Nuevo mensaje en la orden #${compraId}`;
  const targets: NotifTarget[] = [];

  if ((compra.comprador as any)?.id) {
    const uid = (compra.comprador as any).id;
    if (!(senderRole === 'user' && senderId === uid)) {
      targets.push({ userId: uid, userRole: 'user', contexto: undefined, texto });
    }
  }

  if ((compra.compradorTienda as any)?.id) {
    const uid = (compra.compradorTienda as any).id;
    if (!(senderRole === 'tiendaRetiro' && senderId === uid)) {
      targets.push({ userId: uid, userRole: 'tiendaRetiro', contexto: 'compra', texto });
    }
  }

  const vendedoresYa = new Set<number>();
  const tiendasVentaYa = new Set<number>();

  for (const item of compra.itemCartas.getItems()) {
    const v = (item as any).uploaderVendedor;
    const t = (item as any).uploaderTienda;

    if (v?.id && v.user?.id && !vendedoresYa.has(v.id)) {
      vendedoresYa.add(v.id);
      if (!(senderRole === 'vendedor' && senderId === v.id)) {
        targets.push({ userId: v.user.id, userRole: 'vendedor', contexto: 'venta', texto });
      }
    }

    if (t?.id && !tiendasVentaYa.has(t.id)) {
      tiendasVentaYa.add(t.id);
      if (!(senderRole === 'tiendaRetiro' && senderId === t.id)) {
        targets.push({ userId: t.id, userRole: 'tiendaRetiro', contexto: 'venta', texto });
      }
    }
  }

  // tiendaRetiro (gestión) no participa en el chat — no recibe notificaciones de mensajes

  return targets;
}

async function persistirYEmitir(
  targets: NotifTarget[],
  tipo: 'compra_estado' | 'nuevo_mensaje',
  compraId: number
): Promise<void> {
  const em = orm.em.fork();
  const now = new Date().toISOString();
  for (const target of targets) {
    em.create(Notificacion, {
      userId: target.userId,
      userRole: target.userRole,
      contexto: target.contexto,
      tipo,
      compraId,
      texto: target.texto,
      leida: false,
    });
    io.to(`user-${target.userId}`).emit('nueva_notificacion', {
      userId: target.userId,
      userRole: target.userRole,
      contexto: target.contexto ?? null,
      tipo,
      compraId,
      texto: target.texto,
      leida: false,
      createdAt: now,
    });
  }
  await em.flush();
}

export async function crearNotificacionesEstado(compraId: number, nuevoEstado: string): Promise<void> {
  try {
    const compra = await loadCompraConActores(compraId);
    if (!compra) return;
    const estadoLabel = ESTADO_LABELS[nuevoEstado] ?? nuevoEstado;
    const targets = resolveTargetsEstado(compra, nuevoEstado, estadoLabel);
    await persistirYEmitir(targets, 'compra_estado', compraId);
  } catch (e) {
    console.error('[notificacion.service] crearNotificacionesEstado error:', e);
  }
}

export async function crearNotificacionesMensaje(
  compraId: number,
  senderRole: string,
  senderId: number
): Promise<void> {
  try {
    const compra = await loadCompraConActores(compraId);
    if (!compra) return;
    const targets = resolveTargetsMensaje(compra, senderRole, senderId);
    await persistirYEmitir(targets, 'nuevo_mensaje', compraId);
  } catch (e) {
    console.error('[notificacion.service] crearNotificacionesMensaje error:', e);
  }
}
