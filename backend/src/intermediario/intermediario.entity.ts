import { Entity, PrimaryKey, Property, OneToMany, Collection, Cascade, ManyToMany, OneToOne, Rel } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";

@Entity()
export class Intermediario extends BaseEntity {
    @Property({ type: 'string', nullable: false, unique: true })
    nombre!: string;

    @Property({ type: 'string', nullable: false, unique: true })
    email!: string;

    @Property({ type: 'string', hidden: true, nullable: false })
    password!: string;

    @Property({ type: 'string', nullable: false })
    telefono!: string;

    @Property({ type: 'string', hidden: true, nullable: true })
    resetPasswordToken?: string;

    @Property({ type: 'datetime', hidden: true, nullable: true })
    resetPasswordExpires?: Date;

    @Property({ type: 'string', nullable: true })
    descripcion?: string;

    @Property({ type: 'boolean', default: true })
    activo!: boolean;

    // Dirección única de recogida/entrega
    @OneToOne(() => Direccion, { nullable: true, cascade: [Cascade.PERSIST, Cascade.REMOVE] })
    direccion?: Rel<Direccion>;

    @ManyToMany({ entity: () => ItemCarta, mappedBy: 'intermediarios' })
    itemCartas = new Collection<ItemCarta>(this);
}
