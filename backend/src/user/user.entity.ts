import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
export class User extends BaseEntity {
  @Property({ type: 'string', nullable: false, unique: true })
  username!: string;

  @Property({ type: 'string', nullable: false, unique: true })
  email!: string;

  @Property({ type: 'string', hidden: true, nullable: false })
  password!: string;

  @Property({ type: 'string', nullable: false, default: 'user' })
  role!: string;

  @Property({ type: 'string', hidden: true, nullable: true })
  resetPasswordToken?: string;

  @Property({ type: 'datetime', hidden: true, nullable: true })
  resetPasswordExpires?: Date;

  @Property({ type: 'boolean', default: false })
  is_email_verified!: boolean;

  @Property({ type: 'boolean', default: false })
  is_phone_verified!: boolean;
}
