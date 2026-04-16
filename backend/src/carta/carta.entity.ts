import { Entity, Property, ManyToOne, ManyToMany, Collection, Cascade, Rel } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import {CartaClass } from "./cartaClass.entity.js";
import { ItemCarta } from "./itemCarta.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";

@Entity()
export class Carta extends BaseEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'string', nullable: true })
  price?: string;

  @Property({ nullable: true, columnType: 'text' })
  image?: string;

  @Property({ type: 'string', nullable: true })
  link?: string;

  @Property({ type: 'string', nullable: true })
  rarity?: string;

  @Property({ type: 'string', nullable: true })
  setName?: string;

  @Property({ type: 'string', nullable: true })
  setCode?: string;

  @Property({ type: 'string', nullable: true })
  cardNumber?: string;

  @ManyToOne(() => CartaClass, { nullable: true })
  cartaClass?: Rel<CartaClass>;

  @ManyToMany(() => ItemCarta, (item) => item.cartas, {
    cascade: [Cascade.ALL],
    owner: true,
    nullable: true,
  })
  items = new Collection<ItemCarta>(this);

  @ManyToOne(() => Vendedor, { nullable: true })
  uploader?: Rel<Vendedor>;
}
