import { Entity, Property, ManyToOne, ManyToMany, Collection, Cascade, Rel } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import {CartaClass } from "./cartaClass.entity.js";
import { ItemCarta } from "./itemCarta.entity.js";

@Entity()
export class Carta extends BaseEntity {
  @Property()
  name!: string;

  @Property({ nullable: true })
  price?: string;

  @Property({ nullable: true })
  image?: string;

  @Property({ nullable: true })
  link?: string;

  @Property({ nullable: true })
  rarity?: string;

  @Property({ nullable: true })
  setName?: string;

  @ManyToOne(() => CartaClass, { nullable: true })
  cartaClass?: Rel<CartaClass>;

  @ManyToMany(() => ItemCarta, (item) => item.cartas, {
    cascade: [Cascade.ALL],
    owner: true,
    nullable: true,
  })
  items = new Collection<ItemCarta>(this);
}
