import { Collection, Entity, ManyToMany, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Carta } from "./carta.entity.js";

@Entity()
export class ItemCarta extends BaseEntity {
    @Property({nullable: true, unique: true})
    name!: string 

    @Property()
    description!: string

    @ManyToMany(() => Carta, (Carta) => Carta.items)
    cartas = new Collection<Carta>(this) 
}