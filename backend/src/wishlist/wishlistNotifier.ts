import { EntityManager } from "@mikro-orm/postgresql";
import { Wishlist } from "./wishlist.entity.js";
import { User } from "../user/user.entity.js";
import { sendEmail } from "../shared/mailer.js";
import { Carta } from "../carta/carta.entity.js";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function notifyWishlistSubscribers(em: EntityManager, cartaId: number): Promise<void> {
  try {
    const carta = await em.findOne(
      Carta,
      { id: cartaId },
      { populate: ['cartaClass', 'uploader'] }
    );
    if (!carta) return;

    const cartaPrice = carta.price
      ? parseFloat(carta.price.replace(/[^0-9.]/g, ''))
      : null;

    // Buscar todas las cartas con el mismo nombre para encontrar suscriptores por cartaId
    const cartasDelMismoNombre = await em.find(Carta, { name: carta.name }, { fields: ['id'] });
    const cartaIdsDelMismoNombre = cartasDelMismoNombre.map(c => c.id).filter((id): id is number => id !== undefined);

    // Buscar entradas de wishlist: por cartaClass (si aplica) o por cartaId (mismo nombre)
    const entries = await em.find(
      Wishlist,
      {
        notificar: true,
        $or: [
          ...(carta.cartaClass ? [{ cartaClass: carta.cartaClass }] : []),
          { cartaId: { $in: cartaIdsDelMismoNombre } },
        ],
      },
      { populate: ['cartaClass'] }
    );

    const now = new Date();
    const toNotify: Wishlist[] = [];

    for (const entry of entries) {
      // Cooldown de 24h por entrada
      if (entry.ultimaNotificacion) {
        const elapsed = now.getTime() - entry.ultimaNotificacion.getTime();
        if (elapsed < COOLDOWN_MS) continue;
      }

      // Filtro de idioma (solo filtra si ambos están definidos)
      if (entry.idioma && carta.lang && entry.idioma !== carta.lang) continue;

      // Filtro de ciudad: si el usuario eligió una ciudad, el vendedor debe operar en ella
      if (entry.ciudad && carta.uploader) {
        const vendedorCiudad = (carta.uploader as any).ciudad as string | undefined;
        if (vendedorCiudad && vendedorCiudad.toLowerCase() !== entry.ciudad.toLowerCase()) continue;
      }

      // Filtro de precio máximo
      if (
        entry.precioMax !== null &&
        entry.precioMax !== undefined &&
        cartaPrice !== null
      ) {
        if (cartaPrice > entry.precioMax) continue;
      }

      toNotify.push(entry);
    }

    for (const entry of toNotify) {
      const user = await em.findOne(User, { id: entry.userId });
      if (!user?.email) continue;

      const cartaName = carta.cartaClass?.name ?? carta.name;
      const precioStr =
        cartaPrice !== null ? `$${cartaPrice.toLocaleString('es-AR')}` : 'Sin precio';
      const cityLabel =
        entry.ciudad === 'rosario'
          ? 'Rosario'
          : entry.ciudad === 'buenos_aires'
          ? 'Buenos Aires'
          : null;

      const subject = `¡Tu carta deseada está disponible! ${cartaName}`;

      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fffbf5;border-radius:12px;border:1px solid #fed7aa;">
          <h2 style="color:#f97316;margin:0 0 8px;">¡Buenas noticias!</h2>
          <p style="color:#374151;margin:0 0 16px;">Una carta de tu lista de deseos acaba de publicarse en HeroClash4Geeks:</p>
          <div style="background:white;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:16px;overflow:hidden;">
            ${carta.image ? `<img src="${carta.image}" alt="${cartaName}" style="width:80px;float:right;border-radius:6px;margin-left:12px;">` : ''}
            <strong style="font-size:18px;color:#1f2937;">${cartaName}</strong>
            ${carta.setName ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">${carta.setName}</p>` : ''}
            ${carta.rarity ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">Rareza: ${carta.rarity}</p>` : ''}
            ${carta.lang ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">Idioma: ${carta.lang.toUpperCase()}</p>` : ''}
            <p style="color:#f97316;font-weight:bold;font-size:22px;margin:8px 0;">${precioStr}</p>
            ${cityLabel ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">📍 ${cityLabel}</p>` : ''}
            <div style="clear:both;"></div>
          </div>
          <p style="color:#6b7280;font-size:12px;margin:0;">
            Recibís este email porque la carta está en tu lista de deseos.<br>
            Para desactivar estas alertas, ingresá a tu wishlist y desactivá las notificaciones de esta carta.
          </p>
        </div>
      `;

      const text = `¡${cartaName} está disponible! Precio: ${precioStr}. Ingresá a HeroClash4Geeks para verla.`;
      await sendEmail(user.email, subject, text, html);

      entry.ultimaNotificacion = now;
    }

    if (toNotify.length > 0) {
      await em.flush();
    }
  } catch (err) {
    console.error('[wishlistNotifier] Error:', err);
  }
}
