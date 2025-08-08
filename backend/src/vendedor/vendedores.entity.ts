import crypto from 'node:crypto';

export class Vendedor{
    constructor(
        public nombre: string,
        public email: string,
        public telefono: string,
        //public rating: number,
        public id: string = crypto.randomUUID(),
      ) {}
    }