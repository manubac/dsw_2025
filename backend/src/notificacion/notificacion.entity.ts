import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../shared/db/baseEntity.js';

@Entity()
export class Notificacion extends BaseEntity {
  @Property({ type: 'number' })
  userId!: number;

  @Property({ type: 'string' })
  userRole!: string;

  @Property({ type: 'string', nullable: true })
  contexto?: 'compra' | 'venta' | 'gestion';

  @Property({ type: 'string' })
  tipo!: 'compra_estado' | 'nuevo_mensaje';

  @Property({ type: 'number' })
  compraId!: number;

  @Property({ type: 'text' })
  texto!: string;

  @Property({ type: 'boolean', default: false })
  leida: boolean = false;
}
