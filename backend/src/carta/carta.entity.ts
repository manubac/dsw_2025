import { Entity, Property, ManyToOne, ManyToMany, Collection, Cascade, Rel } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import {CartaClass } from "./cartaClass.entity.js";

@Entity()
export class Carta extends BaseEntity{
    @Property({ nullable: false })
    name!: string;

    @ManyToOne(() => CartaClass, { nullable: false})
    cartaClass!: Rel<CartaClass>  

    @Property({ nullable: false })
    level!: number;

    @Property({ nullable: false })
    hp!: number;

    @Property({ nullable: false })
    mana!: number;

    @Property({ nullable: false })
    attack!: number;

}