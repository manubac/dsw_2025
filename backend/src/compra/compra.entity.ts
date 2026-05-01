import { Entity, Property, ManyToOne, ManyToMany, Collection } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { Envio } from "../envio/envio.entity.js";
import { TiendaRetiro } from "../tiendaRetiro/tiendaRetiro.entity.js";

@Entity()
export class Compra extends BaseEntity {
  @ManyToOne(() => User, { nullable: true })
  comprador?: User;

  @ManyToOne(() => TiendaRetiro, { nullable: true })
  compradorTienda?: TiendaRetiro;

  @ManyToMany(() => ItemCarta, undefined, { owner: true })
  itemCartas = new Collection<ItemCarta>(this);

  @Property({ type: "number" })
  total!: number;

  @Property({ type: 'string', default: "pendiente" })
  estado!: string;

  // Datos de checkout (agregados)
  @Property({ type: 'string', nullable: true })
  nombre?: string;

  @Property({ type: 'string', nullable: true })
  email?: string;

  @Property({ type: 'string', nullable: true })
  telefono?: string;

  @ManyToOne(() => Direccion, { nullable: true })
  direccionEntrega?: Direccion;

  @ManyToOne(() => Envio, { nullable: true })
  envio?: Envio;

  @ManyToOne(() => TiendaRetiro, { nullable: true })
  tiendaRetiro?: TiendaRetiro;

  @Property({ type: 'string', nullable: true })
  metodoPago?: string;


  @Property({ type: 'json', nullable: true })
  items?: { cartaId: number; quantity: number; price?: number; title?: string }[];

  @Property({ type: 'string', nullable: true })
  canceladoPorRol?: 'comprador' | 'vendedor' | 'tienda';

  @Property({ type: 'number', nullable: true })
  canceladoPorId?: number;

  @Property({ type: 'string', nullable: true })
  canceladoPorActorTipo?: string;

  @Property({ type: 'string', nullable: true })
  motivoCancelacion?: string;

  @Property({ type: 'date', nullable: true })
  fechaCancelacion?: Date;

  @Property({ type: 'string', nullable: true })
  estadoAntesCancelacion?: string;
}
