import crypto from 'node:crypto';

export class User {
  constructor(
    public username: string,
    public email: string,
    public password: string,
    public role: string = 'user',      // por defecto 'user'
    public id: string = crypto.randomUUID()
  ) {}
}
