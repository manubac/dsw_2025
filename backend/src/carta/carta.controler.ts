import { Request, Response, NextFunction } from "express";
import { CartaRepositoy } from "./carta.repository.js";
import { Carta } from "./carta.entity.js";

const repository = new CartaRepositoy() 

function sanitizeCartaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    cartaClass: req.body.cartaClass,
    level: req.body.level,
    hp: req.body.hp,
    mana: req.body.mana,
    attack: req.body.attack,
    items: req.body.items,
  }
}

function findAll(req: Request, res: Response) {
    res.json({data: repository.findAll()})
}

function findOne (req: Request, res: Response) {
    const id = req.params.id
    const carta = repository.findOne({id})
    if(!carta) {
        res.status(404).send({ message: 'Carta not found' })  
    }
    res.json({data: carta})
}




function add(req: Request, res: Response) {
    const input = req.body.sanitizedInput

    const cartaInput = new Carta(
        input.name, input.cartaClass, input.level, input.hp, input.mana, input.attack, input.items
    )

    const carta = repository.add(cartaInput) 
    return res.status(201).send({message: 'carta created', data: carta})

}

function update(req: Request, res: Response) {
    req.body.sanitizedInput.id = req.params.id
    const carta = repository.update(req.body.sanitizedInput)

    if(!carta) {
        return res.status(404).send({ message: 'Carta not found' })
    }
    
    return res.status(200).send({ message: 'Carta updated', data: carta })  

}


function remove(req: Request, res: Response) {
  const id = req.params.id  
  const carta = repository.delete({id})

  if (!carta) {
    res.status(404).send({ message: 'Carta not found' })
  } else {
    res.status(200).send({ message: 'Carta deleted successfully' })
  }
}

export { sanitizeCartaInput, findAll, findOne, add, update, remove };

