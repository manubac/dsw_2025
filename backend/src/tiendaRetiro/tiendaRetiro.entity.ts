import { Entity, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

export type HorarioDia = {
  abre: string;
  cierra: string;
  cerrado: boolean;
};

export type HorarioSemanal = {
  lunes:     HorarioDia;
  martes:    HorarioDia;
  miercoles: HorarioDia;
  jueves:    HorarioDia;
  viernes:   HorarioDia;
  sabado:    HorarioDia;
  domingo:   HorarioDia;
};

@Entity()
export class TiendaRetiro extends BaseEntity {
  @Property({ type: 'string' })
  nombre!: string;

  @Property({ type: 'string' })
  direccion!: string;

  @Property({ type: 'json', nullable: false })
  horario!: HorarioSemanal;

  @Property({ type: 'boolean', default: true })
  activo!: boolean;

  @Property({ type: 'string', nullable: false, unique: true })
  email!: string;

  @Property({ type: 'string', hidden: true, nullable: false })
  password!: string;

  @Property({ type: 'string', nullable: true })
  ciudad?: string;

  @Property({ type: 'string', nullable: true })
  telefono?: string;

  @Property({ type: 'string', nullable: true })
  alias?: string;

  @Property({ type: 'string', nullable: true })
  cbu?: string;

  @Property({ type: 'text', nullable: true })
  descripcionCompra?: string;

  @Property({ type: 'string', nullable: true })
  googleMapsUrl?: string;

  @Property({ type: 'decimal', nullable: true, precision: 10, scale: 7 })
  latitud?: number;

  @Property({ type: 'decimal', nullable: true, precision: 10, scale: 7 })
  longitud?: number;
}
