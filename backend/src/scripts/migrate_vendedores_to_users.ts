import 'dotenv/config';
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import { VerificationCode } from '../verification/verificationCode.entity.js';
import { Carta } from '../carta/carta.entity.js';
import { CartaClass } from '../carta/cartaClass.entity.js';
import { ItemCarta } from '../carta/itemCarta.entity.js';
import { Compra } from '../compra/compra.entity.js';
import { Direccion } from '../direccion/direccion.entity.js';
import { Intermediario } from '../intermediario/intermediario.entity.js';
import { Envio } from '../envio/envio.entity.js';
import { Valoracion } from '../valoracion/valoracion.entity.js';
import { StagePokemon } from '../stage/stage.entity.js';
import { Mensaje } from '../mensaje/mensaje.entity.js';
import { Wishlist } from '../wishlist/wishlist.entity.js';
import { TiendaRetiro } from '../tiendaRetiro/tiendaRetiro.entity.js';

// Migration already executed — all Vendedores have been linked to a User.
// This script now serves as a verification/no-op check.

const orm = await MikroORM.init({
  entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, User, Direccion, Intermediario, Envio, Valoracion, StagePokemon, Mensaje, Wishlist, TiendaRetiro, VerificationCode],
  clientUrl: process.env.DB_CONNECTION_STRING || 'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
  highlighter: new SqlHighlighter(),
  debug: false,
});

const em = orm.em.fork();

const unlinked = await em.count(Vendedor, { user: null });
if (unlinked === 0) {
  console.log('Todos los Vendedores ya tienen User asociado. Nada que migrar.');
} else {
  console.log(`Hay ${unlinked} Vendedor(es) sin User. Ejecutar migración manual con psql o ajustar este script.`);
}

await orm.close();
