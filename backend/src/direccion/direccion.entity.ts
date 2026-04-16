import { Entity, Property, ManyToOne, Rel, OneToOne } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";

@Entity()
export class Direccion extends BaseEntity {
    @Property({ type: 'string', nullable: false })
    provincia!: string;

    @Property({ type: 'string', nullable: false })
    ciudad!: string;

    @Property({ type: 'string', nullable: false })
    codigoPostal!: string;

    @Property({ type: 'string', nullable: false })
    calle!: string;

    @Property({ type: 'string', nullable: false })
    altura!: string;

    @Property({ type: 'string', nullable: true })
    departamento?: string;

    @ManyToOne(() => User, { nullable: true })
    usuario?: Rel<User>;

    @OneToOne({ entity: () => Intermediario, mappedBy: 'direccion' })
    intermediario?: Rel<Intermediario>;
}
