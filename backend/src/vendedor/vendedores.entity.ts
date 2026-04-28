import { Entity, Property, OneToMany, ManyToMany, Collection, OneToOne, Rel } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { ItemCarta } from "../carta/itemCarta.entity.js"
import { TiendaRetiro } from "../tiendaRetiro/tiendaRetiro.entity.js"
import { User } from "../user/user.entity.js"

@Entity()
export class Vendedor extends BaseEntity {
    @OneToOne(() => User, { owner: true, unique: true, nullable: false })
    user!: Rel<User>

    @Property({ type: 'string', nullable: false, unique: true })
    nombre!: string

    @Property({ type: 'string', nullable: false, unique: true })
    telefono!: string

    @Property({ type: 'string', nullable: true })
    ciudad?: string

    @Property({ type: 'string', nullable: true })
    alias?: string

    @Property({ type: 'string', nullable: true })
    cbu?: string

    @OneToMany(() => ItemCarta, (itemCarta) => itemCarta.uploaderVendedor)
    itemCartas = new Collection<ItemCarta>(this)

    @ManyToMany(() => TiendaRetiro, undefined, { owner: true })
    tiendasRetiro = new Collection<TiendaRetiro>(this)
}
