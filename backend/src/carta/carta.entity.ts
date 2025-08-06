import crypto from 'node:crypto'

export class Carta {
  constructor(
    public name: string,
    public cartaClass: string,
    public level: number,
    public hp: number,
    public mana: number,
    public attack: number,
    public items: string[],
    public id = crypto.randomUUID()
  ) {}
}