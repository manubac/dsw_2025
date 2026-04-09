import { Entity, Property, ManyToOne, ManyToMany, Collection } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { Envio } from "../envio/envio.entity.js";

@Entity()
export class Compra extends BaseEntity {
  @ManyToOne(() => User)
  comprador!: User;

  @ManyToMany(() => ItemCarta, undefined, { owner: true })
  itemCartas = new Collection<ItemCarta>(this);

  @Property({ type: "number" })
  total!: number;

  @Property({ default: "pendiente" })
  estado!: string;

  // Datos de checkout (agregados)
  @Property({ nullable: true })
  nombre?: string;

  @Property({ nullable: true })
  email?: string;

  @Property({ nullable: true })
  telefono?: string;

  @ManyToOne(() => Direccion, { nullable: true })
  direccionEntrega?: Direccion;

  @ManyToOne(() => Envio, { nullable: true })
  envio?: Envio;

  @Property({ nullable: true })
  metodoPago?: string;

  
  @Property({ type: 'json', nullable: true })
  items?: { cartaId: number; quantity: number; price?: number; title?: string }[];
}
