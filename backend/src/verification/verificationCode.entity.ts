import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '../shared/db/baseEntity.js';
import { User } from '../user/user.entity.js';

@Entity()
export class VerificationCode extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ type: 'string' })
  codeHash!: string;

  @Property({ type: 'string' })
  purpose!: string;

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'boolean', default: false })
  used!: boolean;
}
