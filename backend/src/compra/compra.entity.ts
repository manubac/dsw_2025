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
}
