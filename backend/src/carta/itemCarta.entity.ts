import { Collection, Entity, ManyToMany, Property, ManyToOne, Rel } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Carta } from "./carta.entity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";
import { Compra } from "../compra/compra.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";

@Entity()
export class ItemCarta extends BaseEntity {
    @Property({ type: 'string', nullable: true })
    name!: string

    @Property({ type: 'text' })
    description!: string

    @Property({ type: 'number' })
    stock!: number

    @Property({ type: 'string' })
    estado!: string

    @ManyToOne(() => Vendedor, { nullable: true })
    uploaderVendedor!: Rel<Vendedor>;

    @ManyToMany(() => Carta, (Carta) => Carta.items)
    cartas = new Collection<Carta>(this)

    @ManyToMany(() => Intermediario)
    intermediarios = new Collection<Intermediario>(this)

    @ManyToMany({ entity: () => Compra, mappedBy: 'itemCartas' })
    compras = new Collection<Compra>(this)
}
