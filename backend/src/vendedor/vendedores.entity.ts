import { Entity, PrimaryKey, Property, OneToMany, Collection } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { ItemCarta } from "../carta/itemCarta.entity.js"

@Entity()
export class Vendedor extends BaseEntity {
    @Property({ type: 'string', nullable: false, unique: true })
    nombre!: string

    @Property({ type: 'string', nullable: false, unique: true })
    email!: string

    @Property({ type: 'string', hidden: true, nullable: false })
    password!: string

    @Property({ type: 'string' })
    telefono!: string

    @Property({ type: 'string', nullable: true })
    ciudad?: string

    @Property({ type: 'string', hidden: true, nullable: true })
    resetPasswordToken?: string;

    @Property({ type: 'datetime', hidden: true, nullable: true })
    resetPasswordExpires?: Date;

    //public rating: number,

    @OneToMany(() => ItemCarta, (itemCarta) => itemCarta.uploaderVendedor)
    itemCartas = new Collection<ItemCarta>(this)
}
