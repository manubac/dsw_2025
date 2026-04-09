import { Entity, Property, ManyToOne, Rel, OneToOne } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";

@Entity()
export class Direccion extends BaseEntity {
    @Property({ nullable: false })
    provincia!: string;

    @Property({ nullable: false })
    ciudad!: string;

    @Property({ nullable: false })
    codigoPostal!: string;

    @Property({ nullable: false })
    calle!: string;

    @Property({ nullable: false })
    altura!: string;

    @Property({ nullable: true })
    departamento?: string;

    @ManyToOne(() => User, { nullable: true })
    usuario?: Rel<User>;

    @OneToOne({ entity: () => Intermediario, mappedBy: 'direccion' })
    intermediario?: Rel<Intermediario>;
}