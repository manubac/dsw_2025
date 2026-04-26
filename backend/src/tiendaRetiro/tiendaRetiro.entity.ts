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
}
