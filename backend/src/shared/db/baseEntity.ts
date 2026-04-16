import { PrimaryKey, Property } from "@mikro-orm/core";

export abstract class BaseEntity {
    @PrimaryKey({ type: 'number' })
    id?: number

    @Property({ type: 'datetime', defaultRaw: 'CURRENT_TIMESTAMP' })
    createdAt?: Date = new Date();

    @Property({ type: 'datetime', onUpdate: () => new Date(), defaultRaw: 'CURRENT_TIMESTAMP' })
    updatedAt?: Date = new Date();
}