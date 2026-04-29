import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../shared/db/baseEntity.js';

@Entity()
export class StoreInvite extends BaseEntity {
  @Property({ type: 'string', unique: true, nullable: false })
  token!: string;

  @Property({ type: 'boolean', default: false })
  used!: boolean;

  @Property({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Property({ type: 'boolean', default: false })
  phoneVerified!: boolean;
}
