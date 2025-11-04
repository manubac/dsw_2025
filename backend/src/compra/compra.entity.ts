import { Entity, Property, ManyToOne, ManyToMany, Collection } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";
import { Carta } from "../carta/carta.entity.js";

@Entity()
export class Compra extends BaseEntity {
  @ManyToOne(() => User)
  comprador!: User;

  @ManyToMany(() => Carta, undefined, { owner: true })
  cartas = new Collection<Carta>(this);

  @Property({ type: "number" })
  total!: number;

  @Property({ default: "pendiente" })
  estado!: string;

  // 🧾 Datos de checkout (agregados)
  @Property({ nullable: true })
  nombre?: string;

  @Property({ nullable: true })
  email?: string;

  @Property({ nullable: true })
  telefono?: string;

  @Property({ nullable: true })
  direccion?: string;

  @Property({ nullable: true })
  ciudad?: string;

  @Property({ nullable: true })
  provincia?: string;

  @Property({ nullable: true })
  codigoPostal?: string;

  @Property({ nullable: true })
  metodoPago?: string;

  
  @Property({ type: 'json', nullable: true })
  items?: { cartaId: number; quantity: number; price?: number; title?: string }[];
}
