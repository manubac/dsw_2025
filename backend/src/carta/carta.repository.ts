import { repository } from "../shared/repository.js";
import { Carta } from "./carta.entity.js";

const cartas = [
  new Carta(
    'Charizard',
    'fire',
    36,
    78,
    50,
    84,
    ['Flamethrower', 'Fire Spin'],
    'a02b91bc-3769-4221-beb1-d7a3aeba7dad'
  ),
]

export class CartaRepositoy implements repository<Carta>{
    public findAll(): Carta[] | undefined {
        return cartas;
    }

    public findOne(item: {id: string}): Carta | undefined {
         return cartas.find((carta)=> carta.id === item.id);
    }

    public add(item: Carta): Carta | undefined {
        cartas.push(item);
        return item;
    }

    public update(item: Carta): Carta | undefined {
        const cartaIdx = cartas.findIndex((carta) => carta.id === item.id);
        if (cartaIdx !== -1){
            cartas[cartaIdx] = { ...cartas[cartaIdx], ...item };
        }
        return cartas[cartaIdx];
        
    }

    public delete(item: {id: string}): Carta | undefined {
        const cartaIdx = cartas.findIndex((carta) => carta.id === item.id)

     if (cartaIdx !== -1) {
        const deletedCartas = cartas[cartaIdx]
        cartas.splice(cartaIdx, 1)
        return deletedCartas
     }
    }

}