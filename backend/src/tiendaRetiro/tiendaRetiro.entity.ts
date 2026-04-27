import { Entity, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
export class TiendaRetiro extends BaseEntity {
  @Property({ type: 'string' })
  nombre!: string;

  @Property({ type: 'string' })
  direccion!: string;

  @Property({ type: 'string', nullable: true })
  horario?: string;

  @Property({ type: 'boolean', default: true })
  activo!: boolean;

  @Property({ type: 'string', nullable: false, unique: true })
  email!: string;

  @Property({ type: 'string', hidden: true, nullable: false })
  password!: string;

  @Property({ type: 'string', nullable: true })
  ciudad?: string;
}
